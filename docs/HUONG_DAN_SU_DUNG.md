# 📘 HƯỚNG DẪN CÀI ĐẶT VÀ SỬ DỤNG - PHẦN MỀM QUẢN LÝ CẦM ĐỒ 55

Chào mừng bạn đến với **Cầm Đồ 55**! Đây là một hệ thống phần mềm quản lý tài chính, cho vay tín chấp và cầm cố thế chấp được phát triển bằng **ReactJS, TailwindCSS, và Tauri Engine**. Phần mềm được tối ưu hoá đặc biệt mang trải nghiệm mượt mà của ứng dụng Native trên macOS.

---

## 💻 PHẦN I: HƯỚNG DẪN CÀI ĐẶT (INSTALLATION)

Phần mềm sử dụng Tauri để đóng gói thành ứng dụng Native. Có 2 phương pháp cài đặt:

### Phương pháp 1: Cài đặt từ File Đóng gói (.dmg) - Dành cho Người Dùng Cuối
Nếu bạn đã build (biên dịch) phần mềm thành công bằng lệnh `npm run tauri build`:
1. Mở thư mục chứa kết quả ở đường dẫn: `src-tauri/target/release/bundle/dmg/`.
2. Tìm đến file có định dạng `cam-do-55_1.0.0_aarch64.dmg` (hoặc `x64.dmg`).
3. Nhấp đúp chuột để mở. Cửa sổ cài đặt hiện ra.
4. Kéo biểu tượng **Cầm Đồ 55** thả vào thư mục **Applications** bên cạnh.
5. Mở Launchpad hoặc Spotlight (Cmd + Space), gõ "Cam Do 55" và chạy phần mềm!

*(Lưu ý: Trong lần chạy đầu tiên, macOS có thể báo lỗi phần mềm từ nhà phát triển không xác định. Bạn chỉ cần vào **System Settings > Privacy & Security**, kéo xuống tìm và chọn **Open Anyway**).*

### Phương pháp 2: Dành Cho Nhà Phát Triển (Biên dịch từ Source Code)
Để có thể mở mã nguồn, chỉnh sửa và đóng gói lại phiên bản mới, máy tính macOS của bạn cần được cài đặt đầy đủ môi trường (Môi trường lập trình). Thực hiện tuần tự các bước sau:

**Bước 1: Cài đặt Homebrew (Trình quản lý gói cho macOS)**
Mở ứng dụng `Terminal` trên Mac và dán dòng lệnh sau:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Bước 2: Cài đặt Node.js và npm**
Nền tảng giao diện của App được xây dựng bằng React/Vite.
Chạy lệnh sau trong Terminal để cài đặt Node.js:
```bash
brew install node
```
*Kiểm tra thành công: Gõ `node -v` và `npm -v` sẽ hiện ra phiên bản.*

**Bước 3: Cài đặt Python 3**
Hệ thống sử dụng Python để tự động kết xuất ra File Word đính kèm (DOCX Engine).
```bash
brew install python
pip3 install python-docx
```

**Bước 4: Cài đặt Rust và Cargo (Tauri Backend Engine)**
Lõi hệ thống Tauri chạy bằng Rust để tương tác trực tiếp với máy Mac siêu nhanh.
Dán lệnh sau vào Terminal, khi hiện tuỳ chọn hãy bấm số `1` (Proceed with standard installation) và Enter:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Bước 5: Khởi chạy và Build Mã Nguồn**
Sử dụng Terminal, di chuyển thư mục vào bên trong dự án:
```bash
cd "/đường/dẫn/tới/cam-do-55"
```
Cài đặt thư viện:
```bash
npm install
```
Chạy thử trên Cửa sổ App (Dùng để xem code trực tiếp):
```bash
npm run tauri dev
```
Đóng gói (Build) thành File Cài đặt Độc lập (.dmg và .app) để cài tự do vào máy:
```bash
npm run tauri build
```
*(File thành phẩm sẽ được nhả ra tại thư mục: `src-tauri/target/release/bundle/dmg/`)*

## ⚙️ PHẦN II: HƯỚNG DẪN SỬ DỤNG NGHIỆP VỤ (USER MANUAL)

### 1. Bảng Điều Khiển Tổng Quan (Dashboard)
Ngay khi mở App, màn hình Dashboard cung cấp cái nhìn trọn vẹn về dòng tiền của cửa tiệm:
- **Tổng Vốn Đang Cho Vay:** Cập nhật cộng dồn số vốn đang kẹt ở khách.
- **Tiền Lãi Dự Kiến:** Tổng số tiền lãi đang tạm tính (theo ngày) của toàn bộ các khoản vay đang chạy.
- Cảnh báo nhanh các hợp đồng "Đến Hạn", "Quá Hạn" cần gọi điện hối thúc khách hàng.

### 2. Thêm Hợp Đồng Tín Chấp / Thế Chấp Mới (Onboarding)
- **Bước 1:** Bấn nút dấu `+` (Hoặc Tạo Hợp Đồng) trên góc App.
- **Bước 2:** Chọn phân loại:
  - **Tín Chấp:** (Vay Nóng, Bốc Bát Họ) Chỉ cần nhập Tên, SĐT, Số Tiền.
  - **Thế Chấp:** (Cầm Đồ) Chọn Thêm Mới Tài Sản (Xe Máy, Ô tô, BĐS). Nhập mô tả, và nhập giá tiền ước định cho từng món một. Hàm tự động sẽ cộng gộp giá trị tất cả món tài sản thành Tổng tiền vay.
- **Bước 3:** Nhập Thoả thuận Lãi suất (VNĐ / 1 Triệu / 1 Ngày).
- **Bước 4:** Ấn Lưu. Phần mềm sẽ thông báo tạo thành công.

### 3. Vòng Đời Trạng Thái Khoản Vay (Tracking Lifecycle)
Sau khi tạo, Máy đếm ngày sẽ khởi chạy, tình trạng sinh lời được update Live realtime mỗi ngày:
- **0 - 26 Ngày (Đang Chờ):** Giai đoạn nuôi vốn, tự động cộng lãi hàng ngày.
- **27 - 29 Ngày (Cảnh Báo):** Khoản vay hiện vàng báo hiệu sắp đến hạn 30 ngày chốt lãi.
- **30 Ngày (Đến Hạn):** Tới định kỳ thu phí.
- **Qua 30 Ngày (Quá Hạn):** Đánh dấu nợ xấu, chuyển tab cảnh báo đỏ khẩn cấp.

### 4. Đóng Lãi Tái Ký (Rollover)
Khi khách đến hạn không có tiền chuộc, chỉ có tiền đóng lãi tháng đó để gia hạn:
- Bấm vào khoản vay -> Chọn **Chức năng Tái Ký**.
- Điền số lãi khách đóng. Ấn Nhận.
- **Hệ thống tự động:** Khép lại hợp đồng cũ (lưu lịch sử Lợi Nhuận), và đẻ ra 1 Hợp đồng Mới Cứng tiếp nối với Cùng số tiền gốc, Ngày bắt đầu biến thành Hôm Nay, Bộ đếm ngày Reset về 0.

### 5. Tất Toán và Thanh Lý (Checkout & Liquidate)
- **Chuộc Đồ (Tất toán):** Khách mang cụm cục Tiền Gốc + Lãi đến. Bấm tất toán. Khoản vay kết thúc (Chuyển trạng thái Đã Xong), Tiền về quỹ.
- **Thanh lý:** Khách bùng nợ chạy mất. Bạn ném Khoản Vay đó sang trạng thái **Thanh Lý**. Toàn bộ tài sản cấn nợ (Xe cộ, Laptop...) bị đẩy vào Kho Thanh Lý. Khi nào bán được ở ngoài thì chốt cập nhật Lời/Lỗ (PNL) thực tế.

---

### 6. Cài đặt và Sử dụng Trợ lý AI (Telegram Bot)
Tính năng độc quyền giúp chủ tiệm kiểm soát cửa hàng từ xa qua điện thoại.
- **Bước 1 (Lấy Token):** Mở ứng dụng Telegram trên điện thoại, tìm bot `@BotFather`. Gõ lệnh `/newbot` để tạo 1 con bot của riêng bạn. Copy dòng API Token mà nó cấp.
- **Bước 2 (Kết nối):** Mở giao diện Cầm Đồ 55 trên máy tính. Vào **Cài Đặt (Hình bánh răng) -> AI Telegram**. Dán Token vào và lưu lại. *(Token của bạn sẽ được mã hoá lưu an toàn ở tầng sâu hệ điều hành macOS)*.
- **Bước 3 (Giao tiếp):** Mở chat với con Bot trên Telegram của bạn, nhắn: *"Hôm nay có bao nhiêu hợp đồng tới hạn?"* hoặc *"Tính cho tôi lãi khách Nguyễn Văn A"*. Con bot sẽ quét Database ở nhà và trả lời bạn như người thật!

### 7. Tra Cứu Khách Hàng Nhanh (Search & Insight)
- Tại màn hình **Kho Tài Sản / Tổng Quan**, bạn sẽ thấy một ô Tìm kiếm mạnh mẽ.
- Nhập Tên hoặc Số Điện Thoại của khách hàng bất kỳ.
- Hệ thống sẽ quét toàn bộ Database (Bao gồm cả các khoản vay đã đóng và tài sản đã thanh lý).
- Giao diện sẽ thống kê tức thì: Khách hàng này đã mang lại **Tổng Lợi Nhuận Bao Nhiêu** từ trước đến nay, và hiện tại đang cầm những món đồ gì. Rất hữu ích để đánh giá độ Uy tín (Credit Score) của khách hàng.

---

## 🖨 PHẦN III: HƯỚNG DẪN XUẤT VÀ IN ẤN HỢP ĐỒNG PHÁP LÝ

Tại mục Danh Sách Hợp Đồng, bấm vào Hành động (Quyển Sách / Chấm Ba chấm), chọn **"In Biên Nhận / Lưu Giấy"**. Hệ thống cung cấp Form giấy tờ chuẩn mực nhất tuân thủ Nghị Định 30:

### 1. Xuất Bản Lưu Trữ Word (.docx)
- Bấm "Lưu File DOCX". File Word hoàn chỉnh sẽ được lưu ngay tức khắc vào máy tính của bạn thông qua Hộp thoại (Save As).
- File Word cực kỳ sạch sẽ: Tính năng *Tab Leaders* được mã hoá từ gốc, canh lề khít kịt. Tên tiệm, tên khách tự điền vào. Không bao giờ bị lệch ngạc nhiên khi mở trên các máy khác nhau.

### 2. Xem Trước và Xuất PDF Chất Lượng Cao
- Khung màn hình Preview sẽ hiển thị cho bạn thấy trước y hệt tờ giấy A4 ngoài đời.
- Thuật toán Dàn trang (`html2pdf` with `avoid-all` css engine) đảm bảo các đoạn văn, bảng chữ ký sẽ được ép xuống hẳn trang 2 nếu dòng bị lửng lơ. Không một nét chữ nào bị "Rớt dòng" hoặc "Chém làm đôi".
- Bấm nút xanh **LƯU PDF / IN**. Giao thoa trực tiếp qua Hệ Điều Hành macOS, 1 Form PDF pháp lý (Lề Trái 3cm để đóng gáy file) sẽ được in thành ảnh Vector siêu nét, sẵn sàng quăng qua Zalo hoặc in máy lade đưa khách ký tươi liền tay.

---
*Mọi thắc mắc hoặc lỗi phần mềm, vui lòng liên hệ Bộ phận Phát triển để được Fix nóng!*
*Phát triển bởi đội ngũ kỹ thuật Cầm Đồ 55 - 2026 - (Powered By Tauri & Deepmind Ai).*
