use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
#[cfg(test)]
use std::path::Path;

use crate::quota::QuotaRow;

pub trait TokenVault {
    fn save_refresh_token(&mut self, account_id: &str, refresh_token: &str) -> Result<(), String>;
    fn load_refresh_token(&self, account_id: &str) -> Result<String, String>;
    fn delete_refresh_token(&mut self, account_id: &str) -> Result<(), String>;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountRecord {
    pub id: String,
    pub email: String,
    pub tier: Option<String>,
    pub quota: Vec<QuotaRow>,
    pub quota_refreshed_at: Option<String>,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub needs_relogin: bool,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AccountIndex {
    ordered_ids: Vec<String>,
    current_account_id: Option<String>,
}

pub struct AccountStore<V: TokenVault> {
    root_dir: PathBuf,
    token_vault: V,
}

impl<V: TokenVault> AccountStore<V> {
    pub fn open(root_dir: PathBuf, token_vault: V) -> Result<Self, String> {
        fs::create_dir_all(root_dir.join("accounts")).map_err(|error| error.to_string())?;
        let store = Self {
            root_dir,
            token_vault,
        };
        if !store.index_path().exists() {
            store.write_index(&AccountIndex::default())?;
        }
        Ok(store)
    }

    pub fn list_accounts(&self) -> Result<Vec<AccountRecord>, String> {
        let index = self.read_index()?;
        index
            .ordered_ids
            .iter()
            .map(|account_id| self.read_record(account_id))
            .collect()
    }

    pub fn current_account_id(&self) -> Result<Option<String>, String> {
        Ok(self.read_index()?.current_account_id)
    }

    pub fn read_ui_locale(&self) -> String {
        match fs::read_to_string(self.root_dir.join("ui-locale")) {
            Ok(value) if value.trim() == "en" => "en".to_string(),
            _ => "vi".to_string(),
        }
    }

    pub fn write_ui_locale(&self, locale: &str) -> Result<(), String> {
        let value = if locale == "en" { "en" } else { "vi" };
        fs::write(self.root_dir.join("ui-locale"), value).map_err(|error| error.to_string())
    }

    pub fn align_current_account(&mut self, refresh_token: Option<&str>) -> Result<(), String> {
        let Some(refresh_token) = refresh_token.map(str::trim).filter(|value| !value.is_empty()) else {
            return Ok(());
        };
        let matched_id = self.list_accounts()?.into_iter().find_map(|record| {
            let stored_token = self.load_refresh_token(&record.id).ok()?;
            (stored_token == refresh_token).then_some(record.id)
        });
        let mut index = self.read_index()?;
        if index.current_account_id == matched_id {
            return Ok(());
        }
        index.current_account_id = matched_id;
        self.write_index(&index)
    }

    pub fn upsert_account(&mut self, email: &str, refresh_token: &str) -> Result<AccountRecord, String> {
        let clean_email = email.trim();
        if clean_email.is_empty() {
            return Err("Email trống.".into());
        }
        if refresh_token.trim().is_empty() {
            return Err("Refresh token trống.".into());
        }

        let mut index = self.read_index()?;
        if let Some(existing) = self.find_by_email(&index, clean_email)? {
            self.token_vault
                .save_refresh_token(&existing.id, refresh_token)?;
            let mut updated = existing;
            updated.email = clean_email.to_string();
            updated.needs_relogin = false;
            updated.last_error = None;
            self.write_record(&updated)?;
            return Ok(updated);
        }

        let account_id = uuid::Uuid::new_v4().to_string();
        self.token_vault
            .save_refresh_token(&account_id, refresh_token)?;
        let created = AccountRecord {
            id: account_id.clone(),
            email: clean_email.to_string(),
            tier: None,
            quota: Vec::new(),
            quota_refreshed_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_used_at: None,
            needs_relogin: false,
            last_error: None,
        };
        self.write_record(&created)?;
        index.ordered_ids.push(account_id);
        self.write_index(&index)?;
        Ok(created)
    }

    pub fn save_record(&mut self, record: &AccountRecord) -> Result<(), String> {
        let index = self.read_index()?;
        if !index.ordered_ids.iter().any(|account_id| account_id == &record.id) {
            return Err(format!("Không thấy tài khoản {}.", record.id));
        }
        self.write_record(record)
    }

    pub fn load_refresh_token(&self, account_id: &str) -> Result<String, String> {
        self.token_vault.load_refresh_token(account_id)
    }

    pub fn save_refresh_token(&mut self, account_id: &str, refresh_token: &str) -> Result<(), String> {
        self.token_vault.save_refresh_token(account_id, refresh_token)
    }

    pub fn set_current_account(&mut self, account_id: &str) -> Result<AccountRecord, String> {
        let mut index = self.read_index()?;
        if !index.ordered_ids.iter().any(|stored_id| stored_id == account_id) {
            return Err(format!("Không thấy tài khoản {}.", account_id));
        }
        index.current_account_id = Some(account_id.to_string());
        self.write_index(&index)?;
        let mut record = self.read_record(account_id)?;
        record.last_used_at = Some(chrono::Utc::now().to_rfc3339());
        self.write_record(&record)?;
        Ok(record)
    }

    pub fn delete_account(&mut self, account_id: &str) -> Result<(), String> {
        let mut index = self.read_index()?;
        if !index.ordered_ids.iter().any(|stored_id| stored_id == account_id) {
            return Err(format!("Không thấy tài khoản {}.", account_id));
        }
        self.token_vault.delete_refresh_token(account_id)?;
        index.ordered_ids.retain(|stored_id| stored_id != account_id);
        if index.current_account_id.as_deref() == Some(account_id) {
            index.current_account_id = None;
        }
        self.write_index(&index)?;
        let record_path = self.record_path(account_id);
        if record_path.exists() {
            fs::remove_file(&record_path).map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    fn find_by_email(&self, index: &AccountIndex, email: &str) -> Result<Option<AccountRecord>, String> {
        for account_id in &index.ordered_ids {
            let record = self.read_record(account_id)?;
            if record.email.eq_ignore_ascii_case(email) {
                return Ok(Some(record));
            }
        }
        Ok(None)
    }

    fn read_record(&self, account_id: &str) -> Result<AccountRecord, String> {
        let raw = fs::read_to_string(self.record_path(account_id)).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    fn write_record(&self, record: &AccountRecord) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(record).map_err(|error| error.to_string())?;
        fs::write(self.record_path(&record.id), raw).map_err(|error| error.to_string())
    }

    fn read_index(&self) -> Result<AccountIndex, String> {
        let raw = fs::read_to_string(self.index_path()).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    fn write_index(&self, index: &AccountIndex) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(index).map_err(|error| error.to_string())?;
        fs::write(self.index_path(), raw).map_err(|error| error.to_string())
    }

    fn index_path(&self) -> PathBuf {
        self.root_dir.join("accounts.json")
    }

    fn record_path(&self, account_id: &str) -> PathBuf {
        self.root_dir.join("accounts").join(format!("{account_id}.json"))
    }

    #[cfg(test)]
    pub fn root_dir(&self) -> &Path {
        &self.root_dir
    }
}

#[derive(Default)]
#[cfg(test)]
pub struct MemoryTokenVault {
    tokens: std::collections::HashMap<String, String>,
    pub fail_delete: bool,
}

#[cfg(test)]
impl TokenVault for MemoryTokenVault {
    fn save_refresh_token(&mut self, account_id: &str, refresh_token: &str) -> Result<(), String> {
        self.tokens
            .insert(account_id.to_string(), refresh_token.to_string());
        Ok(())
    }

    fn load_refresh_token(&self, account_id: &str) -> Result<String, String> {
        self.tokens
            .get(account_id)
            .cloned()
            .ok_or_else(|| format!("Không có refresh token cho {account_id}."))
    }

    fn delete_refresh_token(&mut self, account_id: &str) -> Result<(), String> {
        if self.fail_delete {
            return Err("Keychain từ chối xóa.".into());
        }
        self.tokens.remove(account_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_store() -> AccountStore<MemoryTokenVault> {
        let root_dir = std::env::temp_dir().join(format!(
            "antigravity-switcher-test-{}",
            uuid::Uuid::new_v4()
        ));
        AccountStore::open(root_dir, MemoryTokenVault::default()).unwrap()
    }

    #[test]
    fn duplicate_email_updates_one_card_and_keeps_id() {
        let mut store = temp_store();
        let created = store.upsert_account("Ada@Example.com", "token-1").unwrap();
        let updated = store.upsert_account("ada@example.com", "token-2").unwrap();
        assert_eq!(created.id, updated.id);
        assert_eq!(store.list_accounts().unwrap().len(), 1);
        assert_eq!(store.load_refresh_token(&created.id).unwrap(), "token-2");
        let _ = fs::remove_dir_all(store.root_dir());
    }

    #[test]
    fn failed_keychain_delete_keeps_the_card() {
        let mut store = temp_store();
        let created = store.upsert_account("ada@example.com", "token-1").unwrap();
        store.token_vault.fail_delete = true;
        let error = store.delete_account(&created.id).unwrap_err();
        assert!(error.contains("Keychain"));
        assert_eq!(store.list_accounts().unwrap().len(), 1);
        assert!(store.root_dir().join("accounts").join(format!("{}.json", created.id)).exists());
        let _ = fs::remove_dir_all(store.root_dir());
    }

    #[test]
    fn deleting_current_account_clears_current_id() {
        let mut store = temp_store();
        let created = store.upsert_account("ada@example.com", "token-1").unwrap();
        store.set_current_account(&created.id).unwrap();
        store.delete_account(&created.id).unwrap();
        assert_eq!(store.current_account_id().unwrap(), None);
        assert!(store.list_accounts().unwrap().is_empty());
        let _ = fs::remove_dir_all(store.root_dir());
    }

    #[test]
    fn ui_locale_defaults_to_vietnamese_and_accepts_english() {
        let store = temp_store();
        assert_eq!(store.read_ui_locale(), "vi");
        store.write_ui_locale("en").unwrap();
        assert_eq!(store.read_ui_locale(), "en");
        store.write_ui_locale("fr").unwrap();
        assert_eq!(store.read_ui_locale(), "vi");
        let _ = fs::remove_dir_all(store.root_dir());
    }
}
