# Antigravity Switcher v0.1.8

Phiên bản **v0.1.8** sửa chuyển tài khoản cho **Antigravity 2.29**. Switcher ghi phiên vào đúng kho mà app đang đọc, rồi đóng và mở lại Antigravity cùng Antigravity IDE.

---

## Sửa chuyển tài khoản trên Antigravity 2.29

* Antigravity 2.29 đọc phiên từ Keychain (service `gemini`, account `antigravity`) và file `~/.gemini/jetski-standalone-oauth-token`. Bản 0.1.7 chỉ ghi SQLite của Antigravity IDE, nên app khởi động lại nhưng vẫn đăng nhập tài khoản cũ.
* Khi máy đã cài Antigravity.app, Switcher thoát Antigravity và Antigravity IDE nếu chúng đang chạy, ghi phiên mới vào cả hai kho trên, rồi mở lại Antigravity. IDE đang mở lúc bấm chuyển cũng được mở lại.
* Máy chỉ cài Antigravity IDE vẫn ghi phiên vào SQLite như trước.
* Watcher lấy tài khoản đang đăng nhập từ cùng kho phiên đó, nên thẻ đang dùng trong Switcher khớp với Antigravity.

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.8_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.8_x64-setup.exe`
