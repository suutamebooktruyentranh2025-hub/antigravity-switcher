use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::AppState;
use crate::host::apply_quota_refresh;
use crate::quota::has_critical_quota;
use crate::tray::update_tray_icon_state;

pub fn start_hourly_quota_worker(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(3600));
            check_and_refresh_current_account(&app);
        }
    });
}

pub fn check_and_refresh_current_account(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (enabled, current_account_id) = {
        let Ok(store) = state.store.lock() else {
            return;
        };
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

    let refresh_result = {
        let mut store = match state.store.lock() {
            Ok(s) => s,
            Err(_) => return,
        };
        apply_quota_refresh(&mut store, &account_id)
    };

    if let Ok(record) = refresh_result {
        let is_warning = has_critical_quota(&record.quota);
        update_tray_icon_state(app, is_warning);
        let _ = app.emit("accounts-changed", ());
    }
}
