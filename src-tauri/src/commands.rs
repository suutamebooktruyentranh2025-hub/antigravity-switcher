use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::account_store::{AccountRecord, AccountStore};
use crate::host::{
    app_support_dir, apply_quota_refresh, exchange_auth_code, fetch_quota_snapshot, fetch_user_email,
    logged_in_refresh_token, open_browser, GoogleRefresher, MacIdeProcess, MacIdeSession, MacTokenVault,
};
use crate::oauth::{build_auth_url, callback_page, oauth_client_from_env, parse_callback_request, OAUTH_WAIT_SECONDS};
use crate::switcher::{switch_to_account, IdeProcess, SwitchError};

pub struct PendingOAuth {
    redirect_uri: String,
    auth_code: Arc<Mutex<Option<String>>>,
    started_at: Instant,
}

pub struct AppState {
    pub store: Mutex<AccountStore<MacTokenVault>>,
    pub pending_oauth: Mutex<Option<PendingOAuth>>,
}

impl AppState {
    pub fn open() -> Result<Self, String> {
        Ok(Self {
            store: Mutex::new(AccountStore::open(app_support_dir(), MacTokenVault)?),
            pending_oauth: Mutex::new(None),
        })
    }
}

#[derive(Serialize)]
pub struct AccountList {
    pub accounts: Vec<AccountRecord>,
    pub current_account_id: Option<String>,
}

#[derive(Serialize)]
pub struct OAuthStart {
    pub url: String,
    pub browser_opened: bool,
}

#[derive(Clone, Serialize)]
struct SwitchPhaseEvent {
    account_id: String,
    phase: String,
}

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<AccountList, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    store.align_current_account(logged_in_refresh_token().as_deref())?;
    Ok(AccountList {
        accounts: store.list_accounts()?,
        current_account_id: store.current_account_id()?,
    })
}

#[tauri::command]
pub fn start_oauth_login(app: AppHandle, state: State<'_, AppState>) -> Result<OAuthStart, String> {
    let (client_id, _) = oauth_client_from_env()?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let local_port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{local_port}/auth/callback");
    let expected_state = uuid::Uuid::new_v4().to_string();
    let auth_url = build_auth_url(&client_id, &redirect_uri, &expected_state)?;
    let auth_code = Arc::new(Mutex::new(None));
    let thread_code = auth_code.clone();
    let thread_state = expected_state.clone();
    let callback_app = app.clone();
    let callback_locale = state.store.lock().map(|store| store.read_ui_locale()).unwrap_or_else(|_| "vi".to_string());
    std::thread::spawn(move || accept_oauth_callback(listener, thread_state, thread_code, callback_app, callback_locale));
    *state.pending_oauth.lock().map_err(|error| error.to_string())? = Some(PendingOAuth {
        redirect_uri,
        auth_code,
        started_at: Instant::now(),
    });
    let browser_opened = open_browser(&auth_url);
    Ok(OAuthStart {
        url: auth_url,
        browser_opened,
    })
}

#[tauri::command]
pub fn finish_oauth_login(app: AppHandle, state: State<'_, AppState>) -> Result<AccountRecord, String> {
    let pending = state
        .pending_oauth
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(|item| {
            (
                item.redirect_uri.clone(),
                item.auth_code.clone(),
                item.started_at,
            )
        })
        .ok_or("Chưa có lượt đăng nhập nào.")?;
    if pending.2.elapsed() > Duration::from_secs(OAUTH_WAIT_SECONDS) {
        *state.pending_oauth.lock().map_err(|error| error.to_string())? = None;
        return Err("Hết giờ đăng nhập. Hãy thử lại.".into());
    }
    let auth_code = pending
        .1
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or("Chưa nhận được mã đăng nhập.")?;
    let fresh_session = exchange_auth_code(&auth_code, &pending.0)?;
    let email = fetch_user_email(&fresh_session.access_token)?;
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let mut record = store.upsert_account(&email, &fresh_session.refresh_token)?;
    match fetch_quota_snapshot(&fresh_session.access_token) {
        Ok((quota_rows, tier)) => {
            record.quota = quota_rows;
            record.tier = tier;
            record.quota_refreshed_at = Some(chrono::Utc::now().to_rfc3339());
            record.last_error = None;
            record.needs_relogin = false;
        }
        Err(error) => {
            record.last_error = Some(error);
        }
    }
    store.save_record(&record)?;
    drop(store);
    *state.pending_oauth.lock().map_err(|error| error.to_string())? = None;
    crate::tray::refresh(&app);
    Ok(record)
}

#[tauri::command(async)]
pub fn refresh_account(app: AppHandle, account_id: String, state: State<'_, AppState>) -> Result<AccountRecord, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let record = apply_quota_refresh(&mut store, &account_id);
    drop(store);
    crate::tray::refresh(&app);
    record
}

#[tauri::command(async)]
pub fn refresh_all_accounts(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<AccountRecord>, String> {
    let account_ids = {
        let store = state.store.lock().map_err(|error| error.to_string())?;
        store.list_accounts()?.into_iter().map(|record| record.id).collect::<Vec<_>>()
    };
    let mut records = Vec::new();
    for account_id in account_ids {
        let mut store = state.store.lock().map_err(|error| error.to_string())?;
        records.push(apply_quota_refresh(&mut store, &account_id)?);
    }
    crate::tray::refresh(&app);
    Ok(records)
}

#[tauri::command]
pub fn switch_account(app: AppHandle, account_id: String) -> Result<AccountRecord, String> {
    let result = switch_saved_account(&app, &account_id);
    crate::tray::refresh(&app);
    result
}

pub fn switch_saved_account(app: &AppHandle, account_id: &str) -> Result<AccountRecord, String> {
    let account_id = account_id.to_string();
    let state = app.state::<AppState>();
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let existing = store
        .list_accounts()?
        .into_iter()
        .find(|record| record.id == account_id)
        .ok_or_else(|| format!("Không thấy tài khoản {account_id}."))?;
    if existing.needs_relogin {
        return Err(error_json(
            "relogin",
            "Phiên hết hạn. Hãy đăng nhập lại tài khoản này.",
        ));
    }
    let refresh_token = store.load_refresh_token(&account_id).map_err(|error| {
        error_json("relogin", &error)
    })?;
    let phase_app = app.clone();
    let phase_account_id = account_id.clone();
    let switched = switch_to_account(
        &refresh_token,
        &GoogleRefresher,
        &MacIdeProcess,
        &MacIdeSession::new(),
        |phase| {
            let _ = phase_app.emit(
                "switch-phase",
                SwitchPhaseEvent {
                    account_id: phase_account_id.clone(),
                    phase: phase.to_string(),
                },
            );
        },
    );
    match switched {
        Ok(fresh_session) => {
            store.save_refresh_token(&account_id, &fresh_session.refresh_token)?;
            store.set_current_account(&account_id)
        }
        Err(error) => {
            let failure_json = switch_error_json(error);
            let failure_message = serde_json::from_str::<serde_json::Value>(&failure_json)
                .ok()
                .and_then(|value| value.get("message").and_then(|item| item.as_str()).map(str::to_string))
                .unwrap_or_else(|| "Chuyển tài khoản lỗi.".into());
            let mut record = existing;
            if failure_json.contains("\"relogin\"") {
                record.needs_relogin = true;
            }
            record.last_error = Some(failure_message);
            store.save_record(&record)?;
            Err(failure_json)
        }
    }
}

#[tauri::command]
pub fn relaunch_antigravity() -> Result<(), String> {
    MacIdeProcess.launch()
}

#[tauri::command]
pub fn delete_account(app: AppHandle, account_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    store.delete_account(&account_id)?;
    drop(store);
    crate::tray::refresh(&app);
    Ok(())
}

#[tauri::command]
pub fn set_ui_locale(app: AppHandle, locale: String, state: State<'_, AppState>) -> Result<(), String> {
    {
        let store = state.store.lock().map_err(|error| error.to_string())?;
        store.write_ui_locale(&locale)?;
    }
    crate::tray::refresh(&app);
    Ok(())
}

fn accept_oauth_callback(
    listener: TcpListener,
    expected_state: String,
    auth_code: Arc<Mutex<Option<String>>>,
    app: AppHandle,
    locale: String,
) {
    let _ = listener.set_nonblocking(false);
    let Ok((mut stream, _)) = listener.accept() else {
        return;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
    let mut buffer = [0_u8; 8192];
    let read_count = stream.read(&mut buffer).unwrap_or(0);
    let request_text = String::from_utf8_lossy(&buffer[..read_count]);
    let first_line = request_text.lines().next().unwrap_or("");
    if let Some((code, state)) = parse_callback_request(first_line) {
        if state == expected_state {
            if let Ok(mut slot) = auth_code.lock() {
                *slot = Some(code);
            }
            let _ = app.emit("oauth-callback-received", ());
        }
    }
    let body = callback_page(&locale);
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn switch_error_json(error: SwitchError) -> String {
    match error {
        SwitchError::RefreshFailed(message) if message.starts_with("relogin:") => {
            error_json("relogin", "Phiên hết hạn. Hãy đăng nhập lại tài khoản này.")
        }
        SwitchError::RefreshFailed(message) => error_json("refresh_failed", &message),
        SwitchError::NotInstalled => error_json("not_installed", "Máy chưa cài Antigravity IDE."),
        SwitchError::StillRunning => {
            error_json("still_running", "Antigravity IDE không chịu thoát. Phiên chưa được ghi.")
        }
        SwitchError::WriteFailed(_) => error_json(
            "write_failed",
            "Ghi phiên lỗi. Antigravity IDE đã được mở lại với phiên cũ.",
        ),
        SwitchError::LaunchFailed(_) => {
            error_json("launch_failed", "Phiên đã ghi nhưng Antigravity IDE không mở lại.")
        }
    }
}

fn error_json(code: &str, message: &str) -> String {
    serde_json::json!({ "code": code, "message": message }).to_string()
}
