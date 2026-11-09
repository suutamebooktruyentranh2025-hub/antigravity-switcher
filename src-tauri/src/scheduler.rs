use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::AppState;
use crate::host::apply_quota_refresh;
use crate::tray::{account_warning_status, update_tray_icon_state};

pub fn start_hourly_quota_worker(app: AppHandle) {
    let app_ide_watcher = app.clone();
    // Giám sát nhẹ thay đổi tài khoản trong Antigravity IDE (mỗi 15 giây)
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(15));
            check_ide_account_change(&app_ide_watcher);
        }
    });

    std::thread::spawn(move || {
        // Kiểm tra hạn mức ngay sau khi mở ứng dụng 2 giây để luôn có dữ liệu mới nhất
        std::thread::sleep(Duration::from_secs(2));
        check_and_refresh_current_account(&app);

        loop {
            std::thread::sleep(Duration::from_secs(3600));
            check_and_refresh_current_account(&app);
        }
    });
}

pub fn check_ide_account_change(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (changed, notification_msg) = {
        let Ok(mut store) = state.store.lock() else {
            return;
        };
        let previous_current_id = store.current_account_id().unwrap_or(None);
        let live_token = crate::host::logged_in_refresh_token();
        let _ = store.align_current_account(live_token.as_deref());
        let current_id = store.current_account_id().unwrap_or(None);

        if previous_current_id != current_id {
            let msg = if let Some(ref new_id) = current_id {
                let email = store.read_record(new_id).map(|r| r.email).unwrap_or_default();
                if !email.is_empty() {
                    Some(format!(
                        "Tài khoản trên {} đã chuyển sang {email}",
                        crate::host::active_product_name()
                    ))
                } else {
                    None
                }
            } else if live_token.is_none() && previous_current_id.is_some() {
                Some(format!(
                    "{} đã đăng xuất tài khoản.",
                    crate::host::active_product_name()
                ))
            } else {
                None
            };
            (true, msg)
        } else {
            (false, None)
        }
    };

    if changed {
        crate::tray::refresh(app);
        let _ = app.emit("accounts-changed", ());
        if let Some(msg) = notification_msg {
            crate::notify::send_notification("Antigravity Switcher", &msg);
        }
    }
}

pub fn check_and_refresh_current_account(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (enabled, current_account_id) = {
        let Ok(mut store) = state.store.lock() else {
            return;
        };
        let _ = store.align_current_account(crate::host::logged_in_refresh_token().as_deref());
        let enabled = store.read_auto_check_quota();
        let current_id = store.current_account_id().unwrap_or(None);
        (enabled, current_id)
    };

    if !enabled {
        return;
    }

    let Some(account_id) = current_account_id else {
        return;
    };

    let _ = app.emit("refreshing-account", Some(&account_id));

    let refresh_result = {
        let mut store = match state.store.lock() {
            Ok(s) => s,
            Err(_) => {
                let _ = app.emit("refreshing-account", None::<String>);
                return;
            }
        };
        apply_quota_refresh(&mut store, &account_id)
    };

    let _ = app.emit("refreshing-account", None::<String>);

    if let Ok(record) = refresh_result {
        let warning = account_warning_status(&record);
        update_tray_icon_state(app, warning);
        crate::tray::refresh(app);
        let _ = app.emit("accounts-changed", ());
    }
}
