use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionTarget {
    Keychain,
    Sqlite,
}

pub fn choose_session_target(version_text: Option<&str>, sqlite_file_exists: bool) -> SessionTarget {
    match version_text.map(str::trim).filter(|value| !value.is_empty()) {
        Some(version_text) if version_is_below_2(version_text) => SessionTarget::Sqlite,
        Some(_) => SessionTarget::Keychain,
        None if sqlite_file_exists => SessionTarget::Sqlite,
        None => SessionTarget::Keychain,
    }
}

pub fn version_is_below_2(version_text: &str) -> bool {
    let mut parts = version_text.split(['.', '-', '+']);
    let major: u64 = parts.next().unwrap_or("0").parse().unwrap_or(0);
    major < 2
}

pub fn encode_keychain_value(
    access_token: &str,
    refresh_token: &str,
    expiry_rfc3339: &str,
    id_token: Option<&str>,
) -> String {
    let mut payload = serde_json::json!({
        "token": {
            "access_token": access_token,
            "token_type": "Bearer",
            "refresh_token": refresh_token,
            "expiry": expiry_rfc3339
        },
        "auth_method": "consumer"
    });
    if let Some(id_token) = id_token.filter(|value| !value.is_empty()) {
        payload["id_token"] = serde_json::Value::String(id_token.to_string());
    }
    let encoded = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        payload.to_string(),
    );
    format!("go-keyring-base64:{encoded}")
}

pub fn ide_state_database(home_dir: &Path) -> PathBuf {
    home_dir.join("Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb")
}

pub const OAUTH_TOKEN_KEY: &str = "antigravityUnifiedStateSync.oauthToken";

pub fn replace_sqlite_oauth_token(db_path: &Path, token_value: &str) -> Result<(), String> {
    if !db_path.is_file() {
        return Err("Không có file SQLite của Antigravity.".into());
    }
    let connection = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?1, ?2)",
            rusqlite::params![OAUTH_TOKEN_KEY, token_value],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn refresh_token_from_oauth_value(encoded: &str) -> Option<String> {
    let topic = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded.trim()).ok()?;
    let entry = protobuf_bytes(&topic, 1)?;
    let row = protobuf_bytes(&entry, 2)?;
    let payload_b64 = protobuf_bytes(&row, 1)?;
    let payload_text = String::from_utf8(payload_b64).ok()?;
    let oauth_info = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, payload_text.trim()).ok()?;
    let refresh_token = String::from_utf8(protobuf_bytes(&oauth_info, 3)?).ok()?;
    if refresh_token.is_empty() {
        None
    } else {
        Some(refresh_token)
    }
}

fn read_varint(data: &[u8], mut offset: usize) -> Option<(u64, usize)> {
    let mut value = 0u64;
    let mut shift = 0;
    while offset < data.len() && shift < 64 {
        let byte = data[offset];
        offset += 1;
        value |= u64::from(byte & 0x7f) << shift;
        if byte < 0x80 {
            return Some((value, offset));
        }
        shift += 7;
    }
    None
}

fn protobuf_bytes(data: &[u8], target_field: u32) -> Option<Vec<u8>> {
    let mut offset = 0;
    while offset < data.len() {
        let (tag, next_offset) = read_varint(data, offset)?;
        let field_number = (tag >> 3) as u32;
        let wire_type = (tag & 7) as u8;
        offset = next_offset;
        match wire_type {
            0 => {
                let (_, next_offset) = read_varint(data, offset)?;
                offset = next_offset;
            }
            2 => {
                let (length, next_offset) = read_varint(data, offset)?;
                let end_offset = next_offset + length as usize;
                if end_offset > data.len() {
                    return None;
                }
                if field_number == target_field {
                    return Some(data[next_offset..end_offset].to_vec());
                }
                offset = end_offset;
            }
            _ => return None,
        }
    }
    None
}

pub fn encode_sqlite_token_value(
    access_token: &str,
    refresh_token: &str,
    expiry_rfc3339: &str,
) -> String {
    let expiry_seconds = chrono::DateTime::parse_from_rfc3339(expiry_rfc3339)
        .map(|value| value.timestamp())
        .unwrap_or(0);
    let payload = oauth_info_bytes(access_token, refresh_token, expiry_seconds);
    let topic = unified_topic_bytes("oauthTokenInfoSentinelKey", &payload);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, topic)
}

fn encode_varint(mut value: u64) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        bytes.push(byte);
        if value == 0 {
            break;
        }
    }
    bytes
}

fn encode_len_delim_field(field_number: u32, data: &[u8]) -> Vec<u8> {
    let mut bytes = encode_varint(((field_number << 3) | 2) as u64);
    bytes.extend(encode_varint(data.len() as u64));
    bytes.extend_from_slice(data);
    bytes
}

fn encode_string_field(field_number: u32, value: &str) -> Vec<u8> {
    encode_len_delim_field(field_number, value.as_bytes())
}

fn oauth_info_bytes(access_token: &str, refresh_token: &str, expiry_seconds: i64) -> Vec<u8> {
    let mut timestamp = encode_varint((1 << 3) as u64);
    timestamp.extend(encode_varint(expiry_seconds as u64));
    [
        encode_string_field(1, access_token),
        encode_string_field(2, "Bearer"),
        encode_string_field(3, refresh_token),
        encode_len_delim_field(4, &timestamp),
    ]
    .concat()
}

fn unified_topic_bytes(sentinel_key: &str, payload: &[u8]) -> Vec<u8> {
    let encoded_payload = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, payload);
    let row = encode_string_field(1, &encoded_payload);
    let entry = [
        encode_string_field(1, sentinel_key),
        encode_len_delim_field(2, &row),
    ]
    .concat();
    encode_len_delim_field(1, &entry)
}

pub fn read_sqlite_oauth_token(db_path: &Path) -> Result<Option<String>, String> {
    if !db_path.is_file() {
        return Ok(None);
    }
    let connection = rusqlite::Connection::open(db_path).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT value FROM ItemTable WHERE key = ?1")
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query(rusqlite::params![OAUTH_TOKEN_KEY])
        .map_err(|error| error.to_string())?;
    if let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let value: String = row.get(0).map_err(|error| error.to_string())?;
        return Ok(Some(value));
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oauth_value_round_trips_the_refresh_token() {
        let encoded = encode_sqlite_token_value("access", "refresh-token", "2026-10-09T00:00:00Z");
        assert_eq!(
            refresh_token_from_oauth_value(&encoded).as_deref(),
            Some("refresh-token")
        );
    }

    #[test]
    fn ide_database_path_is_the_ide_profile() {
        let home_dir = Path::new("/Users/example");
        assert_eq!(
            ide_state_database(home_dir),
            home_dir.join("Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb")
        );
    }

    #[test]
    fn version_rules_pick_one_store() {
        assert_eq!(choose_session_target(Some("1.9.0"), true), SessionTarget::Sqlite);
        assert_eq!(choose_session_target(Some("2.0.0"), true), SessionTarget::Keychain);
        assert_eq!(choose_session_target(Some("2.1.4"), false), SessionTarget::Keychain);
        assert_eq!(choose_session_target(None, true), SessionTarget::Sqlite);
        assert_eq!(choose_session_target(None, false), SessionTarget::Keychain);
    }

    #[test]
    fn keychain_value_uses_go_keyring_prefix() {
        let encoded = encode_keychain_value("access", "refresh", "2026-10-09T00:00:00Z", None);
        assert!(encoded.starts_with("go-keyring-base64:"));
        let bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            encoded.trim_start_matches("go-keyring-base64:"),
        )
        .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(payload["token"]["access_token"], "access");
        assert_eq!(payload["token"]["refresh_token"], "refresh");
        assert_eq!(payload["token"]["token_type"], "Bearer");
        assert_eq!(payload["auth_method"], "consumer");
    }

    #[test]
    fn sqlite_replace_rolls_back_when_table_is_missing() {
        let root = std::env::temp_dir().join(format!("agy-sql-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("state.vscdb");
        let connection = rusqlite::Connection::open(&db_path).unwrap();
        connection
            .execute_batch("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT);")
            .unwrap();
        connection
            .execute(
                "INSERT INTO ItemTable (key, value) VALUES (?1, ?2)",
                rusqlite::params![OAUTH_TOKEN_KEY, "old-session"],
            )
            .unwrap();
        drop(connection);

        let broken = root.join("missing.vscdb");
        std::fs::write(&broken, b"not a database").unwrap();
        assert!(replace_sqlite_oauth_token(&broken, "new-session").is_err());
        assert_eq!(
            read_sqlite_oauth_token(&db_path).unwrap().as_deref(),
            Some("old-session")
        );

        replace_sqlite_oauth_token(&db_path, "new-session").unwrap();
        assert_eq!(
            read_sqlite_oauth_token(&db_path).unwrap().as_deref(),
            Some("new-session")
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
