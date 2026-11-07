# Antigravity Switcher v0.1.4

Phiên bản **v0.1.4** cải tiến cơ chế kiểm tra hạn mức tự động: **Tự động làm mới hạn mức ngay khi khởi động ứng dụng** và **đồng bộ trạng thái tức thì khi thay đổi thiết lập**.

---

## 🌟 Những điểm mới trong v0.1.4

### 1. Tự động kiểm tra hạn mức ngay khi mở ứng dụng (Startup Quota Check)
* **Làm mới dữ liệu tức thì:** Ngay sau khi ứng dụng khởi chạy (sau 2 giây chờ hệ thống ổn định), app sẽ tự động gọi API lấy hạn mức mới nhất của tài khoản đang dùng ở chế độ nền (background).
* **Không làm chậm ứng dụng:** Quá trình kiểm tra chạy hoàn toàn ngầm ở tầng Rust, ứng dụng vẫn mở ngay lập tức với dữ liệu cache và tự động cập nhật số % mới khi có phản hồi API.
* Người dùng không còn cần bấm 🔄 *Refresh* thủ công hay phải chờ 60 phút sau khi mở app để biết hạn mức chính xác.

### 2. Kích hoạt kiểm tra ngay khi bật trong Cài đặt
* Khi gạt switch *"Tự động kiểm tra hạn mức mỗi giờ"* sang trạng thái **Bật** trong cửa sổ Cài đặt, app sẽ kích hoạt ngay 1 lần kiểm tra tài khoản active lập tức mà không cần đợi đến chu kỳ 1 giờ tiếp theo.

### 3. Tối ưu hóa đồng bộ Khay hệ thống (Tray Menu & Icon Sync)
* Bổ sung cơ chế đồng bộ toàn bộ menu chuột phải trên khay hệ thống mỗi khi hạn mức được làm mới tự động, đảm bảo nhãn tài khoản và trạng thái cần đăng nhập lại luôn khớp với thực tế.

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.4_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.4_x64-setup.exe`
