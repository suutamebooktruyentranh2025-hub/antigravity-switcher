# Antigravity Switcher

Ứng dụng lưu nhiều tài khoản Antigravity và chuyển tài khoản đang dùng trong Antigravity IDE. App nằm trên thanh menu. Bấm trái icon để mở cửa sổ, bấm phải để chuyển tài khoản nhanh.

Có bản cài cho macOS (DMG) và Windows (EXE). Chuyển phiên IDE chạy trên macOS, với Antigravity IDE tại `/Applications/Antigravity IDE.app`. Đăng nhập tài khoản mới mở bằng Google Chrome.

## Cài từ file DMG

File cài có dạng `Antigravity Switcher_0.1.0_aarch64.dmg` trên máy Apple Silicon, hoặc `Antigravity Switcher_0.1.0_x86_64.dmg` trên máy Intel. Số phiên bản đổi theo `version` trong dự án.

1. Mở file `.dmg`.
2. Kéo **Antigravity Switcher** vào thư mục **Applications** trong cửa sổ đĩa.
3. Tháo đĩa (eject), rồi mở app từ `/Applications`.
4. Lần đầu macOS có thể chặn app. Bấm phải vào app, chọn **Open**, rồi xác nhận **Open**.
5. Nếu vẫn bị chặn, vào **System Settings → Privacy & Security** và chọn **Open Anyway**.
6. Nếu app vẫn không mở được, chạy lệnh sau trong Terminal rồi mở lại app:

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Antigravity Switcher.app"
```

App build trên máy local chưa được Apple notarize, nên Gatekeeper hỏi ở lần mở đầu tiên.

Cửa sổ đóng lại thì app vẫn chạy trên thanh menu. Thoát hẳn bằng menu chuột phải, mục **Thoát**.

## Cài từ file EXE

File cài có dạng `Antigravity Switcher_0.1.0_x64-setup.exe`. Số phiên bản đổi theo `version` trong dự án.

1. Chạy file `setup.exe`.
2. Nếu SmartScreen cảnh báo, chỉ tiếp tục khi bạn tin nguồn file. Chọn **More info**, rồi **Run anyway**. Nhãn nút có thể khác tùy phiên bản Windows.
3. Làm theo trình cài. App xuất hiện trong Start menu.

Bản EXE chưa được Microsoft ký, nên SmartScreen có thể hiện cảnh báo này ở lần chạy đầu.

## Build từ mã nguồn

Cả hai hệ điều hành dùng chung các bước sau, trong thư mục dự án:

```bash
npm install
```

Trước khi build, app cần client OAuth desktop đang nằm trong Antigravity IDE đã cài. Bạn không tạo client này trên Google Cloud, và không khai báo biến môi trường. File nhận hai giá trị là `src-tauri/oauth.local`. File này không được commit.

Trên macOS, đứng ở thư mục dự án và chạy:

```bash
python3 - << 'PY'
from pathlib import Path
import re

ide = Path("/Applications/Antigravity IDE.app/Contents/Resources/app/out/main.js")
text = ide.read_text(errors="replace")
start = text.find("oauthClient.js")
if start < 0:
    raise SystemExit("Không thấy oauthClient.js. Hãy cài Antigravity IDE vào /Applications.")
chunk = text[start:start + 2000]
client_ids = re.findall(r"[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com", chunk)
client_secrets = re.findall(r"GOCSPX-[A-Za-z0-9_-]+", chunk)
if not client_ids or not client_secrets:
    raise SystemExit("Không thấy client OAuth trong Antigravity IDE.")
out = Path("src-tauri/oauth.local")
out.write_text(
    f"ANTIGRAVITY_OAUTH_CLIENT_ID={client_ids[0]}\n"
    f"ANTIGRAVITY_OAUTH_CLIENT_SECRET={client_secrets[0]}\n"
)
print(f"Đã ghi {out}. Không commit file này.")
PY
```

Trên Windows, mở PowerShell tại thư mục dự án và chạy:

```powershell
$candidates = @(
  Join-Path $env:LOCALAPPDATA "Programs\Antigravity IDE\resources\app\out\main.js"
  Join-Path $env:ProgramFiles "Antigravity IDE\resources\app\out\main.js"
)
$ide = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ide) {
  throw "Không thấy Antigravity IDE. Hãy cài IDE trước."
}
$text = [IO.File]::ReadAllText($ide)
$start = $text.IndexOf("oauthClient.js")
if ($start -lt 0) {
  throw "Không thấy oauthClient.js trong Antigravity IDE."
}
$chunk = $text.Substring($start, [Math]::Min(2000, $text.Length - $start))
$clientId = [regex]::Match($chunk, '[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com').Value
$clientSecret = [regex]::Match($chunk, 'GOCSPX-[A-Za-z0-9_-]+').Value
if (-not $clientId -or -not $clientSecret) {
  throw "Không thấy client OAuth trong Antigravity IDE."
}
New-Item -ItemType Directory -Force -Path "src-tauri" | Out-Null
$out = Join-Path (Get-Location) "src-tauri\oauth.local"
@(
  "ANTIGRAVITY_OAUTH_CLIENT_ID=$clientId"
  "ANTIGRAVITY_OAUTH_CLIENT_SECRET=$clientSecret"
) | Set-Content -Path $out -Encoding ascii
Write-Host "Đã ghi $out. Không commit file này."
```

Lúc build, app nhúng hai giá trị này vào bản cài. Máy đã có `oauth.local` và đã build lại thì mở app bình thường. Thiếu file trước khi build thì app vẫn đóng gói được, nhưng thêm tài khoản, làm mới hạn mức và chuyển phiên sẽ báo thiếu client.

Rồi build:

```bash
npm run tauri build
```

Lệnh này trên macOS ra file DMG, trên Windows ra file EXE. Máy Mac không build được EXE.

Muốn chạy bản dev khi đang sửa mã:

```bash
npm run tauri dev
```

Lệnh này cần cùng file `src-tauri/oauth.local`. Cửa sổ dev mở tại `http://localhost:1420`.

### macOS

Cần có sẵn:

- [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/): `xcode-select --install`
- [Node.js](https://nodejs.org/) bản LTS
- [Rust](https://www.rust-lang.org/tools/install) bản stable, gồm `cargo`
- Google Chrome
- Antigravity IDE trong `/Applications`

File cài nằm tại:

```text
src-tauri/target/release/bundle/dmg/Antigravity Switcher_0.1.0_aarch64.dmg
```

Tên file có hậu tố `aarch64` trên Apple Silicon và `x86_64` trên Intel. Mở file `.dmg` và kéo app vào Applications như mục trên.

### Windows

Cần có sẵn:

- Windows 10 hoặc Windows 11
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), workload **Desktop development with C++** (MSVC và Windows SDK)
- [Node.js](https://nodejs.org/) bản LTS
- [Rust](https://www.rust-lang.org/tools/install) với toolchain `x86_64-pc-windows-msvc`
- WebView2. Windows 11 đã có sẵn. Windows 10 cài [WebView2 Evergreen](https://developer.microsoft.com/microsoft-edge/webview2/) nếu máy chưa có

File cài nằm tại:

```text
src-tauri\target\release\bundle\nsis\Antigravity Switcher_0.1.0_x64-setup.exe
```

Trên máy Windows ARM, hậu tố là `arm64` thay vì `x64`. Cách cài và cách xử lý cảnh báo SmartScreen nằm ở mục **Cài từ file EXE**.

Bản EXE mở được cửa sổ app. Thao tác chuyển tài khoản trong Antigravity IDE vẫn gọi đường dẫn, Keychain và lệnh của macOS, nên chưa chạy trên Windows.

## Dùng sau khi cài

1. Mở Antigravity Switcher.
2. Bấm nút **+** để thêm tài khoản. Chrome mở trang đăng nhập Google. App không hỏi mật khẩu.
3. Sau khi Google chuyển về, tài khoản xuất hiện trong lưới. Hạn mức được lấy theo từng model.
4. Bấm icon hai mũi tên trên thẻ, hoặc bấm phải icon trên thanh menu, để chuyển tài khoản. IDE sẽ thoát, ghi phiên mới, rồi mở lại.
5. Mở **Cài đặt** bằng icon bánh răng để đổi ngôn ngữ (Tiếng Việt hoặc English), chế độ sáng/tối, và bảng màu.

Tài khoản đang dùng có viền nổi và nhãn hiện tại. Tài khoản hết phiên cần đăng nhập lại trước khi chuyển.

## Dữ liệu trên máy

| Nội dung | Vị trí |
| --- | --- |
| Danh sách tài khoản | `~/Library/Application Support/Antigravity Switcher` |
| Refresh token của app | Keychain, service `antigravity-switcher` |
| Phiên Antigravity IDE | Keychain và cơ sở dữ liệu của IDE trong `~/Library/Application Support/Antigravity IDE` |
| Ngôn ngữ, giao diện | Lưu trong app, không đưa lên git |

Xóa một tài khoản trong app chỉ gỡ tài khoản khỏi Switcher. Phiên đang mở trong Antigravity IDE được giữ nguyên.

## Gỡ app

1. Thoát Antigravity Switcher từ menu chuột phải.
2. Trên macOS, xóa `Antigravity Switcher.app` khỏi `/Applications`. Trên Windows, vào **Settings → Apps** và gỡ **Antigravity Switcher**.
3. Nếu muốn xóa dữ liệu đã lưu trên macOS, xóa thư mục `~/Library/Application Support/Antigravity Switcher`.
4. Trong Keychain Access, xóa các mục có service `antigravity-switcher` nếu không còn cần token đã lưu.
