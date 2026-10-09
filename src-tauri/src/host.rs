use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use crate::account_store::{AccountRecord, AccountStore, TokenVault};
use crate::oauth::oauth_client_from_env;
use crate::quota::{
    antigravity_user_agent, classify_refresh_failure, load_code_assist_body, parse_tier_id,
    quota_rows_from_sources, QuotaRow, RefreshFailure, ANTIGRAVITY_CLIENT_VERSION,
    MODEL_CATALOG_HOSTS, QUOTA_SUMMARY_HOSTS, TIER_HOSTS,
};
use crate::session::{
    encode_keychain_value, encode_sqlite_token_value, ide_state_database, read_sqlite_oauth_token,
    replace_sqlite_oauth_token, SessionTarget,
};
use crate::switcher::{FreshSession, IdeProcess, IdeSession, TokenRefresher};

pub const ANTIGRAVITY_IDE_APP_PATH: &str = "/Applications/Antigravity IDE.app";
pub const ANTIGRAVITY_IDE_PROCESS_NAME: &str = "Antigravity IDE";
const PROCESS_WAIT: Duration = Duration::from_secs(10);

pub struct MacTokenVault;

impl TokenVault for MacTokenVault {
    fn save_refresh_token(&mut self, account_id: &str, refresh_token: &str) -> Result<(), String> {
        let _ = security(&[
            "delete-generic-password",
            "-s",
            "antigravity-switcher",
            "-a",
            account_id,
        ]);
        let output = security(&[
            "add-generic-password",
            "-s",
            "antigravity-switcher",
            "-a",
            account_id,
            "-w",
            refresh_token,
            "-U",
        ])?;
        command_ok(&output, "Không lưu được refresh token vào Keychain.")
    }

    fn load_refresh_token(&self, account_id: &str) -> Result<String, String> {
        let output = security(&[
            "find-generic-password",
            "-s",
            "antigravity-switcher",
            "-a",
            account_id,
            "-w",
        ])?;
        if !output.status.success() {
            return Err("Không có refresh token trong Keychain.".into());
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    fn delete_refresh_token(&mut self, account_id: &str) -> Result<(), String> {
        let output = security(&[
            "delete-generic-password",
            "-s",
            "antigravity-switcher",
            "-a",
            account_id,
        ])?;
        if output.status.success() || stderr_says_missing(&output) {
            return Ok(());
        }
        Err(format!(
            "Keychain từ chối xóa. {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

pub struct GoogleRefresher;

impl TokenRefresher for GoogleRefresher {
    fn refresh_session(&self, refresh_token: &str) -> Result<FreshSession, String> {
        match refresh_access_session(refresh_token) {
            Ok(fresh_session) => Ok(fresh_session),
            Err(RefreshFailure::Relogin(message)) => Err(format!("relogin:{message}")),
            Err(RefreshFailure::KeepSnapshot(message)) => Err(message),
        }
    }
}

pub struct MacIdeProcess;

impl IdeProcess for MacIdeProcess {
    fn is_installed(&self) -> bool {
        Path::new(ANTIGRAVITY_IDE_APP_PATH).exists()
    }

    fn version_text(&self) -> Option<String> {
        let output = Command::new("defaults")
            .args([
                "read",
                &format!("{ANTIGRAVITY_IDE_APP_PATH}/Contents/Info"),
                "CFBundleShortVersionString",
            ])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let version_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if version_text.is_empty() {
            None
        } else {
            Some(version_text)
        }
    }

    fn prefers_sqlite(&self) -> bool {
        true
    }

    fn is_running(&self) -> bool {
        ide_process_is_running()
    }

    fn quit(&self) -> Result<(), String> {
        let _ = Command::new("osascript")
            .args([
                "-e",
                &format!("tell application \"{ANTIGRAVITY_IDE_PROCESS_NAME}\" to quit"),
            ])
            .output();
        if wait_until(PROCESS_WAIT, || !ide_process_is_running()) {
            Ok(())
        } else {
            Err("Antigravity IDE vẫn đang chạy.".into())
        }
    }

    fn launch(&self) -> Result<(), String> {
        let status = Command::new("open")
            .arg(ANTIGRAVITY_IDE_APP_PATH)
            .status()
            .map_err(|error| error.to_string())?;
        if !status.success() {
            return Err("Không mở được Antigravity IDE.".into());
        }
        if wait_until(PROCESS_WAIT, ide_process_is_running) {
            Ok(())
        } else {
            Err("Antigravity IDE không xuất hiện sau khi mở.".into())
        }
    }
}

pub struct MacIdeSession {
    home_dir: PathBuf,
}

impl MacIdeSession {
    pub fn new() -> Self {
        Self {
            home_dir: home_dir(),
        }
    }
}

impl Default for MacIdeSession {
    fn default() -> Self {
        Self::new()
    }
}

impl IdeSession for MacIdeSession {
    fn sqlite_file_exists(&self) -> bool {
        ide_state_database(&self.home_dir).is_file()
    }

    fn read_backup(&self, target: SessionTarget) -> Result<Option<String>, String> {
        match target {
            SessionTarget::Keychain => read_antigravity_keychain(),
            SessionTarget::Sqlite => read_sqlite_oauth_token(&ide_state_database(&self.home_dir)),
        }
    }

    fn write_session(&self, target: SessionTarget, fresh_session: &FreshSession) -> Result<(), String> {
        match target {
            SessionTarget::Keychain => write_antigravity_keychain(fresh_session),
            SessionTarget::Sqlite => {
                let path = ide_state_database(&self.home_dir);
                let token_value = encode_sqlite_token_value(
                    &fresh_session.access_token,
                    &fresh_session.refresh_token,
                    &fresh_session.expiry_rfc3339,
                );
                replace_sqlite_oauth_token(&path, &token_value)
            }
        }
    }

    fn restore_backup(&self, target: SessionTarget, backup_value: Option<&str>) -> Result<(), String> {
        match target {
            SessionTarget::Keychain => restore_antigravity_keychain(backup_value),
            SessionTarget::Sqlite => {
                let path = ide_state_database(&self.home_dir);
                if !path.is_file() {
                    return Ok(());
                }
                match backup_value {
                    Some(value) => replace_sqlite_oauth_token(&path, value),
                    None => Ok(()),
                }
            }
        }
    }
}

pub fn app_support_dir() -> PathBuf {
    home_dir().join("Library/Application Support/Antigravity Switcher")
}

pub fn executable_belongs_to_ide(command_line: &str) -> bool {
    command_line.contains("/Antigravity IDE.app/Contents/MacOS/")
}

pub fn browser_launch_args(url: &str) -> Vec<String> {
    vec!["-a".to_string(), "Google Chrome".to_string(), url.to_string()]
}

pub fn open_browser(url: &str) -> bool {
    let chrome_opened = Command::new("open")
        .args(browser_launch_args(url))
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    if chrome_opened {
        return true;
    }
    Command::new("open")
        .arg(url)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn refresh_access_session(refresh_token: &str) -> Result<FreshSession, RefreshFailure> {
    let (client_id, client_secret) = oauth_client_from_env().map_err(RefreshFailure::KeepSnapshot)?;
    let client = http_client().map_err(RefreshFailure::KeepSnapshot)?;
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send();
    let response = match response {
        Ok(response) => response,
        Err(error) => return Err(RefreshFailure::KeepSnapshot(error.to_string())),
    };
    let status_code = response.status().as_u16();
    let body_text = response.text().unwrap_or_default();
    if !(200..300).contains(&status_code) {
        return Err(classify_refresh_failure(Some(status_code), &body_text));
    }
    parse_token_body(&body_text, refresh_token).map_err(RefreshFailure::KeepSnapshot)
}

pub fn exchange_auth_code(
    auth_code: &str,
    redirect_uri: &str,
) -> Result<FreshSession, String> {
    let (client_id, client_secret) = oauth_client_from_env()?;
    let client = http_client()?;
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", auth_code),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .map_err(|error| error.to_string())?;
    let status_code = response.status().as_u16();
    let body_text = response.text().unwrap_or_default();
    if !(200..300).contains(&status_code) {
        return Err(format!("Đổi mã đăng nhập lỗi: {body_text}"));
    }
    parse_token_body(&body_text, "")
}

pub fn fetch_user_email(access_token: &str) -> Result<String, String> {
    let client = http_client()?;
    let response = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .map_err(|error| error.to_string())?;
    let body_text = response.text().map_err(|error| error.to_string())?;
    let payload: serde_json::Value = serde_json::from_str(&body_text).map_err(|error| error.to_string())?;
    payload
        .get("email")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|email| !email.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "Google không trả email.".into())
}

pub fn fetch_quota_snapshot(access_token: &str) -> Result<(Vec<QuotaRow>, Option<String>), String> {
    let client = http_client()?;
    let summary_body = post_cloud_code(&client, access_token, &QUOTA_SUMMARY_HOSTS)?;
    let models_body = post_cloud_code(&client, access_token, &MODEL_CATALOG_HOSTS).ok();
    let quota_rows = quota_rows_from_sources(models_body.as_deref(), &summary_body)?;
    let tier = fetch_tier(&client, access_token);
    Ok((quota_rows, tier))
}

fn post_cloud_code(
    client: &reqwest::blocking::Client,
    access_token: &str,
    endpoints: &[&str],
) -> Result<String, String> {
    let mut last_error = "Không gọi được hạn mức.".to_string();
    for endpoint in endpoints {
        match client
            .post(*endpoint)
            .bearer_auth(access_token)
            .header(
                reqwest::header::USER_AGENT,
                antigravity_user_agent(ANTIGRAVITY_CLIENT_VERSION),
            )
            .json(&serde_json::json!({}))
            .send()
        {
            Ok(response) if response.status().is_success() => {
                return response.text().map_err(|error| error.to_string());
            }
            Ok(response) => {
                last_error = format!("Hạn mức trả {}", response.status());
            }
            Err(error) => last_error = error.to_string(),
        }
    }
    Err(last_error)
}

pub fn apply_quota_refresh<V: TokenVault>(
    store: &mut AccountStore<V>,
    account_id: &str,
) -> Result<AccountRecord, String> {
    let mut record = store
        .list_accounts()?
        .into_iter()
        .find(|item| item.id == account_id)
        .ok_or_else(|| format!("Không thấy tài khoản {account_id}."))?;
    let refresh_token = match store.load_refresh_token(account_id) {
        Ok(token) => token,
        Err(error) => {
            record.needs_relogin = true;
            record.last_error = Some(error);
            store.save_record(&record)?;
            return Ok(record);
        }
    };
    let fresh_session = match refresh_access_session(&refresh_token) {
        Ok(session) => session,
        Err(RefreshFailure::Relogin(message)) => {
            record.needs_relogin = true;
            record.last_error = Some(message);
            store.save_record(&record)?;
            return Ok(record);
        }
        Err(RefreshFailure::KeepSnapshot(message)) => {
            record.last_error = Some(message);
            store.save_record(&record)?;
            return Ok(record);
        }
    };
    store.save_refresh_token(account_id, &fresh_session.refresh_token)?;
    match fetch_quota_snapshot(&fresh_session.access_token) {
        Ok((quota_rows, tier)) => {
            record.quota = quota_rows;
            record.tier = tier;
            record.quota_refreshed_at = Some(chrono::Utc::now().to_rfc3339());
            record.needs_relogin = false;
            record.last_error = None;
        }
        Err(error) => {
            let failure = classify_refresh_failure(None, &error);
            match failure {
                RefreshFailure::Relogin(message) => {
                    record.needs_relogin = true;
                    record.last_error = Some(message);
                }
                RefreshFailure::KeepSnapshot(message) => {
                    record.last_error = Some(message);
                }
            }
        }
    }
    store.save_record(&record)?;
    Ok(record)
}

fn fetch_tier(client: &reqwest::blocking::Client, access_token: &str) -> Option<String> {
    for endpoint in TIER_HOSTS {
        let Ok(response) = client
            .post(endpoint)
            .bearer_auth(access_token)
            .header(
                reqwest::header::USER_AGENT,
                antigravity_user_agent(ANTIGRAVITY_CLIENT_VERSION),
            )
            .json(&load_code_assist_body())
            .send()
        else {
            continue;
        };
        if !response.status().is_success() {
            continue;
        }
        let body_text = response.text().unwrap_or_default();
        if let Some(tier) = parse_tier_id(&body_text) {
            return Some(tier);
        }
    }
    None
}

fn parse_token_body(body_text: &str, previous_refresh_token: &str) -> Result<FreshSession, String> {
    let payload: serde_json::Value = serde_json::from_str(body_text).map_err(|error| error.to_string())?;
    let access_token = payload
        .get("access_token")
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .ok_or("Google không trả access token.")?
        .to_string();
    let refresh_token = payload
        .get("refresh_token")
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .unwrap_or(previous_refresh_token)
        .to_string();
    if refresh_token.is_empty() {
        return Err("Google không trả refresh token.".into());
    }
    let expires_in = payload.get("expires_in").and_then(|value| value.as_i64()).unwrap_or(3600);
    let expiry_rfc3339 = (chrono::Utc::now() + chrono::Duration::seconds(expires_in)).to_rfc3339();
    let id_token = payload
        .get("id_token")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    Ok(FreshSession {
        access_token,
        refresh_token,
        expiry_rfc3339,
        id_token,
    })
}

fn write_antigravity_keychain(fresh_session: &FreshSession) -> Result<(), String> {
    let secret = encode_keychain_value(
        &fresh_session.access_token,
        &fresh_session.refresh_token,
        &fresh_session.expiry_rfc3339,
        fresh_session.id_token.as_deref(),
    );
    let _ = security(&["delete-generic-password", "-s", "gemini", "-a", "antigravity"]);
    // -A lets the Antigravity app read this item without an extra prompt.
    let output = security(&[
        "add-generic-password",
        "-s",
        "gemini",
        "-a",
        "antigravity",
        "-w",
        &secret,
        "-A",
    ])?;
    command_ok(&output, "Không ghi được phiên vào Keychain của Antigravity.")
}

fn read_antigravity_keychain() -> Result<Option<String>, String> {
    let output = security(&["find-generic-password", "-s", "gemini", "-a", "antigravity", "-w"])?;
    if !output.status.success() {
        return Ok(None);
    }
    let secret = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if secret.is_empty() {
        Ok(None)
    } else {
        Ok(Some(secret))
    }
}

fn restore_antigravity_keychain(backup_value: Option<&str>) -> Result<(), String> {
    let _ = security(&["delete-generic-password", "-s", "gemini", "-a", "antigravity"]);
    let Some(backup_value) = backup_value else {
        return Ok(());
    };
    let output = security(&[
        "add-generic-password",
        "-s",
        "gemini",
        "-a",
        "antigravity",
        "-w",
        backup_value,
        "-A",
    ])?;
    command_ok(&output, "Không khôi phục được phiên cũ.")
}

fn ide_process_is_running() -> bool {
    let output = Command::new("ps").args(["-ax", "-o", "command="]).output();
    match output {
        Ok(output) => String::from_utf8_lossy(&output.stdout)
            .lines()
            .any(executable_belongs_to_ide),
        Err(_) => false,
    }
}

pub fn logged_in_refresh_token() -> Option<String> {
    let encoded = read_sqlite_oauth_token(&ide_state_database(&home_dir())).ok().flatten()?;
    crate::session::refresh_token_from_oauth_value(&encoded)
}

fn wait_until(limit: Duration, mut condition: impl FnMut() -> bool) -> bool {
    let started = Instant::now();
    while started.elapsed() < limit {
        if condition() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    condition()
}

fn home_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| error.to_string())
}

fn security(args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("security")
        .args(args)
        .output()
        .map_err(|error| error.to_string())
}

fn command_ok(output: &std::process::Output, fallback: &str) -> Result<(), String> {
    if output.status.success() {
        Ok(())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if detail.is_empty() {
            Err(fallback.into())
        } else {
            Err(format!("{fallback} {detail}"))
        }
    }
}

fn stderr_says_missing(output: &std::process::Output) -> bool {
    let detail = String::from_utf8_lossy(&output.stderr).to_lowercase();
    detail.contains("could not be found") || detail.contains("item not found")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ide_process_match_uses_the_app_executable() {
        assert!(executable_belongs_to_ide(
            "/Applications/Antigravity IDE.app/Contents/MacOS/Electron"
        ));
        assert!(!executable_belongs_to_ide(
            "/Applications/Antigravity.app/Contents/MacOS/Antigravity"
        ));
        assert!(!executable_belongs_to_ide("Antigravity IDE"));
    }

    #[test]
    fn browser_launch_targets_google_chrome() {
        assert_eq!(
            browser_launch_args("https://accounts.google.com/o/oauth2/v2/auth"),
            vec![
                "-a".to_string(),
                "Google Chrome".to_string(),
                "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
            ]
        );
    }
}
