# Antigravity Switcher v0.1.6

Phiên bản **v0.1.6** tối ưu hóa cơ chế tự động kiểm tra hạn mức và bổ sung phản hồi trực quan trên giao diện:

---

## 🌟 Những điểm mới trong v0.1.6

### 1. Phản hồi trực quan khi Tự động kiểm tra hạn mức (Visual Quota Refresh Feedback)
* **Hiển thị hiệu ứng xoay trực quan:** Khi ứng dụng tự động kiểm tra hạn mức lúc khởi động (sau 2 giây) hoặc định kỳ mỗi giờ, biểu tượng **🔄 Refresh** trên thẻ tài khoản đang kích hoạt sẽ **tự động xoay tròn** kèm dòng trạng thái *"Đang lấy hạn mức..."*.
* **Xác nhận rõ ràng:** Giúp người dùng nhìn thấy rõ ràng bằng mắt là ứng dụng đang thực sự kiểm tra và lấy hạn mức mới nhất từ Google Cloud Code API.

### 2. Căn chỉnh tài khoản thực tế (`align_current_account`)
* Tiến trình kiểm tra ngầm luôn đồng bộ với token thực tế đang đăng nhập trong Antigravity IDE (Keychain/SQLite) trước khi kiểm tra, đảm bảo không bỏ sót hoặc kiểm tra nhầm tài khoản ngay cả khi người dùng đổi tài khoản từ bên ngoài.

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.6_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.6_x64-setup.exe`
