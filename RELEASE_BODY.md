# Antigravity Switcher v0.1.7

Phiên bản **v0.1.7** mang đến bản nâng cấp giao diện toàn diện **Modern Bento UI**, thiết kế lại hộp thoại **Cài đặt hệ thống (macOS System Preferences Style)**, cùng **Bộ Giám Sát Sức Khỏe Tài Khoản & Gói Cước** và **Thông báo đẩy hệ thống (Native Desktop Notifications)**.

---

## 🌟 Những điểm mới nổi bật trong v0.1.7

### 1. Giao diện Bento Dashboard Hiện Đại (Modern Bento UI)
* **Hero Bento Grid:**
  - **Thẻ tài khoản đang dùng (Active Hero Tile):** Vòng đồng hồ tiến trình SVG (`CircularGauge`) trực quan cho từng model (Flash, Flash Image, Sonnet), phân màu thông minh theo % hạn mức còn lại (>30% Xanh ngọc, 15–30% Cam hổ phách, $\le$15% Đỏ cảnh báo). Tích hợp nút sao chép email 1-chạm và nút làm mới hạn mức tức thì.
  - **Thẻ đo lường hệ thống (System Telemetry Tile):** Hiển thị trạng thái kết nối Antigravity IDE (đèn tín hiệu nhấp nháy), chu kỳ kiểm tra hạn mức tự động (60m), tổng số tài khoản khả dụng và nút "+ Thêm tài khoản" nổi bật.
* **Thẻ tài khoản dự phòng & Bộ chuyển đổi hiển thị:**
  - Định dạng email thông minh (`formatEmail`), tự động rút gọn đuôi `@gmail.com` để giữ thẻ gọn gàng.
  - Căn chỉnh hoàn hảo hàng nút hành động: nút **"Hiện tại"** màu xanh ngọc đậm nét và nút **"Chuyển"** kích thước chuẩn `96px` đồng đều.
  - Chuyển đổi linh hoạt giữa **Dạng lưới thẻ (Grid View)** và **Dạng danh sách gọn (Compact List View)**.
  - Tích hợp thanh cuộn siêu mảnh 6px đồng bộ theo bảng màu theme được chọn.

### 2. Thiết Kế Lại Hộp Thoại Cài Đặt (macOS System Preferences Style)
* **Kiến trúc Bento 2 cột với sidebar chuyển tab nhanh:**
  - 🌐 **Chung & Hạn mức (General & Quota):** Chuyển đổi ngôn ngữ tức thì (`Tiếng Việt` / `English`), Toggle switch kiểu iOS bật/tắt tự động kiểm tra hạn mức mỗi giờ kèm huy hiệu *Khuyên dùng*, tùy chọn khung giờ xem hạn mức mặc định (`5H (Phiên)` / `Tuần`).
  - 🎨 **Giao diện & Theme (Appearance & Theme):** Chế độ hiển thị (`☀️ Sáng` / `🌙 Tối` / `💻 Hệ thống`) thiết kế nhỏ gọn, thẳng hàng trên 1 dòng; Lưới 12 theme presets dạng Bento 2 cột với cụm swatch màu xếp lớp, dấu checkmark nhận diện theme kích hoạt và nút *Về mặc định*.
  - 🚀 **Cập nhật & App (Updates & About):** Logo ứng dụng retina độ phân giải cao, tên ứng dụng, mô tả chức năng, huy hiệu phiên bản, đèn báo trạng thái cập nhật và nút *Kiểm tra cập nhật*.
* Đóng mở tiện lợi qua nút `✕` trên header, phím tắt `ESC` hoặc click ra ngoài backdrop.

### 3. Giám Sát Sức Khỏe Tài Khoản & Cảnh Báo Hạ Cấp Gói Cước (Tier Downgrade Detector)
* **Phát hiện ngay khi tài khoản bị rớt gói PRO $\to$ FREE:** Tự động so sánh gói cước cũ và mới. Nếu tài khoản PRO/ULTRA bị hạ cấp xuống FREE (hết hạn dùng thử, gói Google One bị hủy, lỗi thanh toán), app sẽ:
  - 🔔 Bắn **Desktop Notification** góc màn hình cảnh báo người dùng ngay lập tức.
  - 🏷️ Hiển thị **Banner cảnh báo màu cam** trực tiếp trên thẻ tài khoản trong ứng dụng.
  - 🔴 Kích hoạt **icon cảnh báo trên khay hệ thống (Tray Warning)**.
* **Cảnh báo phiên đăng nhập hết hạn (`needs_relogin`):**
  - Khi token bị Google thu hồi hoặc hết hạn, app lập tức gửi Desktop Notification, hiển thị banner cảnh báo trên thẻ tài khoản và chuyển Tray Icon sang chấm đỏ cảnh báo kèm tooltip giải thích rõ ràng.

### 4. Tự Động Phát Hiện Thay Đổi Tài Khoản từ Antigravity IDE (IDE Account Watcher)
* **Tiến trình ngầm siêu nhẹ (mỗi 15 giây):** Tự động phát hiện khi bạn chuyển đổi tài khoản hoặc đăng xuất trực tiếp bên trong Antigravity IDE mà không cần mở cửa sổ Switcher.
* **Đồng bộ & Bắn thông báo:** Tự động cập nhật trạng thái "Đang dùng" trong Switcher, cập nhật menu khay hệ thống và gửi thông báo màn hình:
  - *"Tài khoản trên Antigravity IDE đã chuyển sang [email]"*
  - Hoặc *"Antigravity IDE đã đăng xuất tài khoản."*

---

## 📦 Tải về bản cài đặt (Download Installers)

* **macOS (Apple Silicon M1/M2/M3/M4):** `Antigravity Switcher_0.1.7_aarch64.dmg`
* **Windows (64-bit):** `Antigravity Switcher_0.1.7_x64-setup.exe`
