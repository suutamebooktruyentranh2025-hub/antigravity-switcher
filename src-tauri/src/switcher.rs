use crate::session::{choose_session_target, SessionTarget};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FreshSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expiry_rfc3339: String,
    pub id_token: Option<String>,
}

pub trait TokenRefresher {
    fn refresh_session(&self, refresh_token: &str) -> Result<FreshSession, String>;
}

pub trait IdeProcess {
    fn is_installed(&self) -> bool;
    fn version_text(&self) -> Option<String>;
    fn prefers_sqlite(&self) -> bool {
        false
    }
    fn is_running(&self) -> bool;
    fn quit(&self) -> Result<(), String>;
    fn launch(&self) -> Result<(), String>;
}

pub trait IdeSession {
    fn sqlite_file_exists(&self) -> bool;
    fn read_backup(&self, target: SessionTarget) -> Result<Option<String>, String>;
    fn write_session(&self, target: SessionTarget, fresh_session: &FreshSession) -> Result<(), String>;
    fn restore_backup(&self, target: SessionTarget, backup_value: Option<&str>) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SwitchError {
    RefreshFailed(String),
    NotInstalled,
    StillRunning,
    WriteFailed(String),
    LaunchFailed(String),
}

pub fn switch_to_account(
    refresh_token: &str,
    refresher: &dyn TokenRefresher,
    process: &dyn IdeProcess,
    session: &dyn IdeSession,
    mut on_phase: impl FnMut(&str),
) -> Result<FreshSession, SwitchError> {
    let fresh_session = refresher
        .refresh_session(refresh_token)
        .map_err(SwitchError::RefreshFailed)?;

    if !process.is_installed() {
        return Err(SwitchError::NotInstalled);
    }

    if process.is_running() {
        on_phase("quitting");
        process.quit().map_err(|_| SwitchError::StillRunning)?;
    }

    let target = if process.prefers_sqlite() {
        SessionTarget::Sqlite
    } else {
        choose_session_target(process.version_text().as_deref(), session.sqlite_file_exists())
    };
    on_phase("writing");
    let backup_value = session
        .read_backup(target)
        .map_err(|error| SwitchError::WriteFailed(error))?;
    if let Err(error) = session.write_session(target, &fresh_session) {
        let _ = session.restore_backup(target, backup_value.as_deref());
        let _ = process.launch();
        return Err(SwitchError::WriteFailed(error));
    }

    on_phase("launching");
    process
        .launch()
        .map_err(SwitchError::LaunchFailed)?;
    Ok(fresh_session)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    struct ScriptedRefresh {
        result: Result<FreshSession, String>,
    }

    impl TokenRefresher for ScriptedRefresh {
        fn refresh_session(&self, _refresh_token: &str) -> Result<FreshSession, String> {
            self.result.clone()
        }
    }

    struct ScriptedProcess {
        installed: bool,
        running: bool,
        quit_error: Option<String>,
        log: Arc<Mutex<Vec<String>>>,
        prefer_sqlite: bool,
        version_text: String,
    }

    impl IdeProcess for ScriptedProcess {
        fn is_installed(&self) -> bool {
            self.installed
        }
        fn version_text(&self) -> Option<String> {
            Some(self.version_text.clone())
        }
        fn prefers_sqlite(&self) -> bool {
            self.prefer_sqlite
        }
        fn is_running(&self) -> bool {
            self.running
        }
        fn quit(&self) -> Result<(), String> {
            self.log.lock().unwrap().push("quit".into());
            match &self.quit_error {
                Some(error) => Err(error.clone()),
                None => Ok(()),
            }
        }
        fn launch(&self) -> Result<(), String> {
            self.log.lock().unwrap().push("launch".into());
            Ok(())
        }
    }

    struct ScriptedSession {
        fail_write: bool,
        log: Arc<Mutex<Vec<String>>>,
    }

    impl IdeSession for ScriptedSession {
        fn sqlite_file_exists(&self) -> bool {
            false
        }
        fn read_backup(&self, _target: SessionTarget) -> Result<Option<String>, String> {
            Ok(Some("previous-session".into()))
        }
        fn write_session(&self, target: SessionTarget, _fresh_session: &FreshSession) -> Result<(), String> {
            self.log.lock().unwrap().push(format!("{target:?}"));
            if self.fail_write {
                Err("disk full".into())
            } else {
                Ok(())
            }
        }
        fn restore_backup(&self, _target: SessionTarget, backup_value: Option<&str>) -> Result<(), String> {
            assert_eq!(backup_value, Some("previous-session"));
            self.log.lock().unwrap().push("restore".into());
            Ok(())
        }
    }

    fn sample_session() -> FreshSession {
        FreshSession {
            access_token: "access".into(),
            refresh_token: "refresh".into(),
            expiry_rfc3339: "2026-10-09T00:00:00Z".into(),
            id_token: None,
        }
    }

    #[test]
    fn refresh_failure_does_not_quit() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let error = switch_to_account(
            "refresh",
            &ScriptedRefresh {
                result: Err("invalid_grant".into()),
            },
            &ScriptedProcess {
                installed: true,
                running: true,
                quit_error: None,
                log: log.clone(),
                prefer_sqlite: false,
                version_text: "2.1.0".into(),
            },
            &ScriptedSession {
                fail_write: false,
                log: log.clone(),
            },
            |_| {},
        )
        .unwrap_err();
        assert!(matches!(error, SwitchError::RefreshFailed(_)));
        assert!(log.lock().unwrap().is_empty());
    }

    #[test]
    fn quit_failure_does_not_write() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let error = switch_to_account(
            "refresh",
            &ScriptedRefresh {
                result: Ok(sample_session()),
            },
            &ScriptedProcess {
                installed: true,
                running: true,
                quit_error: Some("still running".into()),
                log: log.clone(),
                prefer_sqlite: false,
                version_text: "2.1.0".into(),
            },
            &ScriptedSession {
                fail_write: false,
                log: log.clone(),
            },
            |_| {},
        )
        .unwrap_err();
        assert!(matches!(error, SwitchError::StillRunning));
        assert_eq!(log.lock().unwrap().as_slice(), ["quit"]);
    }

    #[test]
    fn ide_switch_writes_sqlite_even_when_version_is_at_least_two() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let error = switch_to_account(
            "refresh",
            &ScriptedRefresh {
                result: Ok(sample_session()),
            },
            &ScriptedProcess {
                installed: true,
                running: false,
                quit_error: None,
                log: log.clone(),
                prefer_sqlite: true,
                version_text: "2.5.5".into(),
            },
            &ScriptedSession {
                fail_write: false,
                log: log.clone(),
            },
            |_| {},
        );
        assert!(error.is_ok());
        assert_eq!(log.lock().unwrap().as_slice(), ["Sqlite", "launch"]);
    }

    #[test]
    fn write_failure_restores_and_relaunches() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let error = switch_to_account(
            "refresh",
            &ScriptedRefresh {
                result: Ok(sample_session()),
            },
            &ScriptedProcess {
                installed: true,
                running: true,
                quit_error: None,
                log: log.clone(),
                prefer_sqlite: false,
                version_text: "2.1.0".into(),
            },
            &ScriptedSession {
                fail_write: true,
                log: log.clone(),
            },
            |_| {},
        )
        .unwrap_err();
        assert!(matches!(error, SwitchError::WriteFailed(_)));
        assert_eq!(
            log.lock().unwrap().as_slice(),
            ["quit", "Keychain", "restore", "launch"]
        );
    }
}
