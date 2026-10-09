use std::fs;
use std::path::Path;

fn main() {
    load_local_oauth();
    tauri_build::build();
}

// Reads a gitignored local file so the desktop OAuth client is compiled in
// without being stored in git. Environment variables still override it.
fn load_local_oauth() {
    println!("cargo:rerun-if-changed=oauth.local");
    let Ok(contents) = fs::read_to_string(Path::new("oauth.local")) else {
        return;
    };
    for line in contents.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        if value.is_empty() {
            continue;
        }
        if key == "ANTIGRAVITY_OAUTH_CLIENT_ID" || key == "ANTIGRAVITY_OAUTH_CLIENT_SECRET" {
            println!("cargo:rustc-env={key}={value}");
        }
    }
}
