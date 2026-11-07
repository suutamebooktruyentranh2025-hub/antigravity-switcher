use std::fs::File;
use std::io::{Read, Write};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

pub const GITHUB_LATEST_API: &str =
    "https://api.github.com/repos/suutamebooktruyentranh2025-hub/antigravity-switcher/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub html_url: Option<String>,
    #[serde(default)]
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub remote_version: String,
    pub download_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub changelog: String,
    pub release_date: String,
    pub release_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub percent: f64,
    pub downloaded: u64,
    pub total: u64,
}

pub fn current_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn is_newer_version(remote: &str, local: &str) -> bool {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches(|c: char| !c.is_ascii_digit())
            .split('.')
            .map(|p| {
                p.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0)
            })
            .collect()
    };
    let r = parse(remote);
    let l = parse(local);
    let max_len = r.len().max(l.len());
    for i in 0..max_len {
        let rv = r.get(i).copied().unwrap_or(0);
        let lv = l.get(i).copied().unwrap_or(0);
        if rv > lv {
            return true;
        }
        if rv < lv {
            return false;
        }
    }
    false
}

pub fn resolve_download_asset(
    assets: &[ReleaseAsset],
    os: &str,
    arch: &str,
) -> Option<ReleaseAsset> {
    if os == "macos" || os == "darwin" {
        if arch == "aarch64" || arch == "arm64" {
            if let Some(asset) = assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                name.ends_with(".dmg") && (name.contains("aarch64") || name.contains("arm64"))
            }) {
                return Some(asset.clone());
            }
            if let Some(asset) = assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                name.ends_with(".dmg")
                    && !name.contains("x64")
                    && !name.contains("x86_64")
                    && !name.contains("intel")
            }) {
                return Some(asset.clone());
            }
        } else {
            if let Some(asset) = assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                name.ends_with(".dmg")
                    && (name.contains("x86_64") || name.contains("x64") || name.contains("intel"))
            }) {
                return Some(asset.clone());
            }
            if let Some(asset) = assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                name.ends_with(".dmg")
                    && !name.contains("aarch64")
                    && !name.contains("arm64")
            }) {
                return Some(asset.clone());
            }
        }
    } else if os == "windows" {
        if let Some(asset) = assets.iter().find(|a| a.name.to_lowercase().ends_with(".exe")) {
            return Some(asset.clone());
        }
    }
    None
}

pub fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("AntigravitySwitcher-Updater/1.0")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(GITHUB_LATEST_API)
        .header(reqwest::header::ACCEPT, "application/vnd.github.v3+json")
        .send()
        .map_err(|e| format!("Không thể kết nối đến GitHub: {e}"))?;

    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Err("Đã vượt quá giới hạn truy vấn GitHub API (Rate Limit), vui lòng thử lại sau ít phút.".into());
    }

    if !response.status().is_success() {
        return Err(format!("GitHub API trả lỗi: {}", response.status()));
    }

    let release: GitHubRelease = response
        .json()
        .map_err(|e| format!("Lỗi phân tích JSON từ GitHub: {e}"))?;

    let current = current_app_version();
    let remote = release.tag_name.trim_start_matches(|c: char| c == 'v' || c == 'V');
    let has_update = is_newer_version(remote, current);

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let asset = resolve_download_asset(&release.assets, os, arch);

    Ok(UpdateCheckResult {
        has_update,
        current_version: current.to_string(),
        remote_version: remote.to_string(),
        download_url: asset.as_ref().map(|a| a.browser_download_url.clone()),
        file_name: asset.as_ref().map(|a| a.name.clone()),
        file_size: asset.as_ref().map(|a| a.size),
        changelog: release.body.unwrap_or_default(),
        release_date: release.published_at.unwrap_or_default(),
        release_url: release.html_url.unwrap_or_default(),
    })
}

pub fn download_update(
    app: &AppHandle,
    download_url: &str,
    file_name: &str,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("antigravity-switcher-update");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let dest_path = temp_dir.join(file_name);

    if dest_path.exists() {
        let _ = std::fs::remove_file(&dest_path);
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("AntigravitySwitcher-Updater/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut response = client
        .get(download_url)
        .send()
        .map_err(|e| format!("Lỗi tải bản cập nhật: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Lỗi khi tải file: HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut file = File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 16384];

    loop {
        let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
        downloaded += n as u64;

        let percent = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0).min(100.0)
        } else {
            0.0
        };

        let _ = app.emit(
            "update-progress",
            UpdateProgress {
                percent,
                downloaded,
                total: total_size,
            },
        );
    }

    let _ = app.emit(
        "update-progress",
        UpdateProgress {
            percent: 100.0,
            downloaded,
            total: downloaded,
        },
    );

    Ok(dest_path.to_string_lossy().to_string())
}

pub fn install_update_and_relaunch(file_path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let timestamp = chrono::Utc::now().timestamp_millis();
        let mount_point = format!("/Volumes/AntigravitySwitcherUpdate_{timestamp}");

        let status = Command::new("hdiutil")
            .args(["attach", file_path, "-mountpoint", &mount_point, "-nobrowse", "-quiet"])
            .status()
            .map_err(|e| format!("Lỗi mount DMG: {e}"))?;

        if !status.success() {
            return Err("Không thể mount file DMG".into());
        }

        let app_name = match std::fs::read_dir(&mount_point) {
            Ok(entries) => entries
                .filter_map(|e| e.ok())
                .find(|e| e.path().extension().map_or(false, |ext| ext == "app"))
                .map(|e| e.file_name().to_string_lossy().to_string()),
            Err(e) => {
                let _ = Command::new("hdiutil").args(["detach", &mount_point, "-quiet"]).status();
                return Err(format!("Lỗi đọc file DMG: {e}"));
            }
        };

        let Some(app_name) = app_name else {
            let _ = Command::new("hdiutil").args(["detach", &mount_point, "-quiet"]).status();
            return Err("Không tìm thấy tệp .app trong DMG".into());
        };

        let src_app = format!("{mount_point}/{app_name}");
        let dest_app = format!("/Applications/{app_name}");

        if std::path::Path::new(&dest_app).exists() {
            let _ = Command::new("rm").args(["-rf", &dest_app]).status();
        }
        let cp_res = Command::new("cp").args(["-R", &src_app, "/Applications/"]).status();

        let _ = Command::new("hdiutil").args(["detach", &mount_point, "-quiet"]).status();

        match cp_res {
            Ok(status) if !status.success() => {
                return Err("Không thể copy ứng dụng mới vào /Applications".into());
            }
            Err(e) => {
                return Err(format!("Lỗi copy ứng dụng vào /Applications: {e}"));
            }
            _ => {}
        }

        // Xóa thuộc tính cách ly (quarantine) để Gatekeeper không chặn phiên bản mới
        let _ = Command::new("xattr").args(["-cr", &dest_app]).status();

        // Đợi tiến trình hiện tại thoát hoàn toàn rồi mới khởi chạy phiên bản mới qua `open`
        let current_pid = std::process::id();
        let relaunch_script = format!(
            "while kill -0 {current_pid} 2>/dev/null; do sleep 0.1; done; sleep 0.3; open \"{dest_app}\""
        );

        Command::new("sh")
            .args(["-c", &relaunch_script])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Lỗi tạo tiến trình khởi động lại: {e}"))?;

        std::process::exit(0);
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new(file_path)
            .args(["/S", "--updated"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Lỗi khởi chạy bộ cài đặt: {e}"))?;
        std::thread::sleep(std::time::Duration::from_millis(500));
        std::process::exit(0);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Hệ điều hành hiện tại chưa hỗ trợ cập nhật tự động".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("0.1.3", "0.1.2"));
        assert!(is_newer_version("v0.2.0", "0.1.9"));
        assert!(is_newer_version("1.0.0", "0.9.9"));
        assert!(!is_newer_version("0.1.2", "0.1.2"));
        assert!(!is_newer_version("0.1.1", "0.1.2"));
        assert!(!is_newer_version("0.1.0", "0.1.2"));
    }

    #[test]
    fn test_resolve_download_asset() {
        let assets = vec![
            ReleaseAsset {
                name: "Antigravity Switcher_0.1.3_aarch64.dmg".into(),
                browser_download_url: "https://github.com/.../aarch64.dmg".into(),
                size: 50_000_000,
            },
            ReleaseAsset {
                name: "Antigravity Switcher_0.1.3_x64-setup.exe".into(),
                browser_download_url: "https://github.com/.../setup.exe".into(),
                size: 40_000_000,
            },
        ];
        let mac_arm = resolve_download_asset(&assets, "macos", "aarch64").unwrap();
        assert_eq!(mac_arm.name, "Antigravity Switcher_0.1.3_aarch64.dmg");

        let win = resolve_download_asset(&assets, "windows", "x86_64").unwrap();
        assert_eq!(win.name, "Antigravity Switcher_0.1.3_x64-setup.exe");
    }
}
