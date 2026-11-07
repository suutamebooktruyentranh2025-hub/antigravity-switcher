# Antigravity Switcher v0.1.3

Phiên bản **v0.1.3** mang đến hai nâng cấp quan trọng: **Cơ chế tự động kiểm tra hạn mức & cảnh báo khay hệ thống** và **Tính năng tự động cập nhật phần mềm trực tiếp từ GitHub Releases (Native Auto-Updater)**.

---

## 🌟 Tính năng mới nổi bật (Highlights)

### 1. Tự Động Kiểm Tra Hạn Mức Mỗi Giờ & Cảnh Báo Khay Hệ Thống (Hourly Quota Check & Tray Warning)
* **Tiến trình ngầm độc lập ở tầng Rust:** Tự động gọi API lấy hạn mức mới nhất của tài khoản đang dùng mỗi 60 phút mà không phụ thuộc vào Webview JavaScript.
* **Cảnh báo khay hệ thống (Menu Bar / System Tray):**
  - Tự động phát hiện khi bất kỳ model nào ở khung ngắn hạn 5H chạm ngưỡng **≤ 5%**.
  - Tự động chuyển đổi icon khay sang icon có huy hiệu cảnh báo màu đỏ/cam nổi bật kèm tooltip cảnh báo người dùng.
  - Tự động khôi phục icon bình thường khi hạn mức an toàn hoặc khi người dùng chuyển sang tài khoản khác.
* **Cảnh báo trực quan trên thẻ tài khoản:** Hiển thị banner cảnh báo `⚠️ Hạn mức 5H của tài khoản này sắp hết (≤ 5%). Hãy đổi tài khoản` ngay trên thẻ tài khoản đang kích hoạt.
* **Tùy chỉnh trong Cài đặt (Settings):** Bổ sung switch toggle *"Tự động kiểm tra hạn mức mỗi giờ"* để người dùng có thể chủ động bật/tắt bất kỳ lúc nào.

---

### 2. Tự Động Cập Nhật Phần Mềm Trực Tiếp (Native Direct Auto-Updater)
* **Kiểm tra phiên bản mới từ GitHub Releases:**
  - Tự động kiểm tra bản cập nhật mới nhất khi khởi động ứng dụng.
  - Tự động lọc đúng file cài đặt theo hệ điều hành và kiến trúc chip:
    - macOS Apple Silicon (M1/M2/M3/M4): Tệp `.dmg` `aarch64`.
    - macOS Intel: Tệp `.dmg` `x86_64`.
    - Windows: Tệp `.exe` NSIS setup.
* **Cửa sổ thông báo cập nhật (Update Modal):**
  - Hiển thị so sánh phiên bản cũ $\to$ mới, ngày phát hành và toàn bộ thông tin cập nhật (Changelog).
  - Tải file cài đặt về thư mục tạm với **thanh tiến trình (Progress Bar)** hiển thị % và dung lượng tải trực quan theo thời gian thực.
* **Cài đặt & Khởi động lại tự động:**
  - **macOS:** Tự động mount silent file DMG, sao chép đè ứng dụng vào `/Applications`, tháo ổ đĩa (unmount), mở lại phiên bản mới và thoát phiên cũ.
  - **Windows:** Chạy bộ cài NSIS ở chế độ ngầm và khởi động lại app.
* **Kiểm tra thủ công:** Bổ sung nút *"Kiểm tra cập nhật"* bên cạnh thông tin phiên bản trong modal Cài đặt.

---

### 3. Cải tiến giao diện & Bản dịch
* Bổ sung đầy đủ chuỗi bản dịch song ngữ **Tiếng Việt** và **English** cho toàn bộ các thông báo, modal và nút chức năng mới.
* Tối ưu hóa hiệu năng và độ mượt mà khi chuyển đổi tài khoản.

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.3_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.3_x64-setup.exe`
