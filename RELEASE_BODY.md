# Antigravity Switcher v0.1.5

Phiên bản **v0.1.5** mang đến các bản sửa lỗi và tinh chỉnh quan trọng cho cơ chế Cập nhật tự động và Cảnh báo hạn mức:

---

## 🌟 Những điểm mới & sửa lỗi trong v0.1.5

### 1. Sửa lỗi tự động khởi động lại sau khi Cập nhật (Auto-Relaunch Fix)
* **Khắc phục lỗi app đóng nhưng không tự mở lại:** Tích hợp tiến trình nền theo dõi PID (detached process watcher). Khi cài đặt xong bản cập nhật mới, tiến trình nền sẽ đợi phiên bản cũ đóng hoàn toàn rồi mới kích hoạt phiên bản mới (`/Applications/Antigravity Switcher.app`).
* **Dọn dẹp kiểm duyệt Gatekeeper:** Tự động loại bỏ cờ `quarantine` trên macOS để tránh bị hệ thống chặn khởi chạy ứng dụng mới tải về.
* **Hỗ trợ cờ `--updated` trên Windows:** Đảm bảo bộ cài đặt NSIS tự động relaunch ứng dụng sau khi cài đặt hoàn tất.

### 2. Tinh chỉnh điều kiện Cảnh báo hạn mức (All 5H Models ≤ 5%)
* **Chỉ cảnh báo khi thực sự cần thiết:** Thay vì chỉ cần 1 model bất kỳ chạm ngưỡng ≤ 5% thì phát cảnh báo, logic mới yêu cầu **TẤT CẢ các model trong khung 5H đều chạm ngưỡng ≤ 5%** mới hiển thị icon cảnh báo trên thanh khay hệ thống (Tray Icon) và biểu ngữ cảnh báo (Warning Banner).
* Nếu chỉ có 1 model hết quota nhưng các model khác vẫn còn hạn mức sử dụng tốt, app sẽ không làm phiền người dùng.

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.5_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.5_x64-setup.exe`
