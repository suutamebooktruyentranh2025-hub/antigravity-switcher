use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::AppState;
use crate::host::apply_quota_refresh;
use crate::quota::has_critical_quota;
use crate::tray::update_tray_icon_state;

pub fn start_hourly_quota_worker(app: AppHandle) {
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
        let is_warning = has_critical_quota(&record.quota);
        update_tray_icon_state(app, is_warning);
        crate::tray::refresh(app);
        let _ = app.emit("accounts-changed", ());
    }
}
