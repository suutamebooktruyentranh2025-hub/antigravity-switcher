use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::{switch_saved_account, AppState};

pub const TRAY_ID: &str = "main";
const ACCOUNT_PREFIX: &str = "account:";

static SWITCH_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

struct TrayCopy {
    show: &'static str,
    quit: &'static str,
    empty: &'static str,
    relogin_suffix: &'static str,
}

fn tray_copy(locale: &str) -> TrayCopy {
    if locale == "en" {
        TrayCopy {
            show: "Open window",
            quit: "Quit",
            empty: "No accounts",
            relogin_suffix: "(sign in again)",
        }
    } else {
        TrayCopy {
            show: "Mở cửa sổ",
            quit: "Thoát",
            empty: "Chưa có tài khoản",
            relogin_suffix: "(đăng nhập lại)",
        }
    }
}

fn ui_locale(app: &AppHandle) -> String {
    app.state::<AppState>()
        .store
        .lock()
        .map(|store| store.read_ui_locale())
        .unwrap_or_else(|_| "vi".to_string())
}

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let copy = tray_copy(&ui_locale(app.handle()));
    let show_item = MenuItem::with_id(app, "show", copy.show, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", copy.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    refresh(app.handle());
    Ok(())
}

pub fn refresh(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let _ = apply_menu(&app);
    });
}

fn handle_menu(app: &AppHandle, item_id: &str) {
    match item_id {
        "quit" => app.exit(0),
        "show" => show_main_window(app),
        _ => {
            let Some(account_id) = item_id.strip_prefix(ACCOUNT_PREFIX) else {
                return;
            };
            let account_id = account_id.to_string();
            let app = app.clone();
            std::thread::spawn(move || switch_from_tray(app, account_id));
        }
    }
}

fn switch_from_tray(app: AppHandle, account_id: String) {
    let already_current = app
        .state::<AppState>()
        .store
        .lock()
        .ok()
        .and_then(|store| store.current_account_id().ok().flatten());
    if already_current.as_deref() == Some(account_id.as_str()) {
        return;
    }
    if SWITCH_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    let _ = switch_saved_account(&app, &account_id);
    let _ = app.emit("accounts-changed", ());
    let _ = apply_menu(&app);
    SWITCH_IN_PROGRESS.store(false, Ordering::SeqCst);
}

fn apply_menu(app: &AppHandle) -> Result<(), String> {
    let (account_rows, current_account_id) = {
        let state = app.state::<AppState>();
        let store = state.store.lock().map_err(|error| error.to_string())?;
        let current_account_id = store.current_account_id().unwrap_or(None);
        let account_rows = store
            .list_accounts()
            .unwrap_or_default()
            .into_iter()
            .map(|record| (record.id, record.email, record.needs_relogin))
            .collect::<Vec<_>>();
        (account_rows, current_account_id)
    };
    let copy = tray_copy(&ui_locale(app));

    let show_item = MenuItem::with_id(app, "show", copy.show, true, None::<&str>).map_err(|error| error.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", copy.quit, true, None::<&str>).map_err(|error| error.to_string())?;
    let top_separator = PredefinedMenuItem::separator(app).map_err(|error| error.to_string())?;
    let bottom_separator = PredefinedMenuItem::separator(app).map_err(|error| error.to_string())?;
    let empty_item = MenuItem::with_id(app, "empty", copy.empty, false, None::<&str>).map_err(|error| error.to_string())?;
    let mut account_items = Vec::new();
    for (account_id, email, needs_relogin) in &account_rows {
        let is_current = current_account_id.as_deref() == Some(account_id.as_str());
        let label = menu_label(email, *needs_relogin, copy.relogin_suffix);
        account_items.push(CheckMenuItem::with_id(
            app,
            format!("{ACCOUNT_PREFIX}{account_id}"),
            label,
            !needs_relogin,
            is_current,
            None::<&str>,
        ).map_err(|error| error.to_string())?);
    }

    let mut menu_refs: Vec<&dyn IsMenuItem<_>> = vec![&show_item, &top_separator];
    if account_items.is_empty() {
        menu_refs.push(&empty_item);
    }
    for account_item in &account_items {
        menu_refs.push(account_item);
    }
    menu_refs.push(&bottom_separator);
    menu_refs.push(&quit_item);
    let menu = Menu::with_items(app, &menu_refs).map_err(|error| error.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu)).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn menu_label(email: &str, needs_relogin: bool, relogin_suffix: &str) -> String {
    let safe_email = email.replace('&', "&&");
    if needs_relogin {
        format!("{safe_email} {relogin_suffix}")
    } else {
        safe_email
    }
}

#[cfg(test)]
mod tests {
    use super::{menu_label, tray_copy};

    #[test]
    fn english_tray_uses_english_labels() {
        let copy = tray_copy("en");
        assert_eq!(copy.show, "Open window");
        assert_eq!(copy.quit, "Quit");
        assert_eq!(menu_label("a&b@example.com", true, copy.relogin_suffix), "a&&b@example.com (sign in again)");
        assert_eq!(tray_copy("vi").empty, "Chưa có tài khoản");
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
