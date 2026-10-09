mod account_store;
mod commands;
mod host;
mod oauth;
mod quota;
mod session;
mod switcher;
mod tray;

use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::open().expect("Không mở được kho tài khoản."))
        .setup(|app| {
            tray::install(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_accounts,
            commands::start_oauth_login,
            commands::finish_oauth_login,
            commands::refresh_account,
            commands::refresh_all_accounts,
            commands::switch_account,
            commands::relaunch_antigravity,
            commands::delete_account,
            commands::set_ui_locale
        ])
        .run(tauri::generate_context!())
        .expect("Antigravity Switcher dừng vì lỗi.");
}

