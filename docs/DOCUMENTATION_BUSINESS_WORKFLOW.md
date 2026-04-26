# QUY TRÌNH NGHIỆP VỤ - HỆ THỐNG CẦM ĐỒ / TÀI CHÍNH

Tài liệu này mô tả chi tiết từng bước (Step-by-step) luồng công việc từ thực tế đến việc số hóa vào hệ thống phần mềm Cầm Đồ. Áp dụng cho các nền tảng vay tín dụng, cầm cố tài sản.

## 1. MÔ HÌNH KINH DOANH CỐT LÕI (CORE BUSINESS MODEL)
Cửa hàng cung cấp 2 dịch vụ chính:
- **Tín chấp:** Cho vay tiền mặt, không thu giữ tài sản thế chấp (dựa vào uy tín, danh dự, địa chỉ, lịch sử tín dụng).
- **Thế chấp:** Cầm cố tài sản (Xe máy, Ô tô, Bất động sản, Thiết bị khác...), khách hàng giao tài sản lưu kho, cửa hàng đưa tiền mặt dựa trên định giá tài sản.

## 2. QUY TRÌNH KHỞI TẠO KHOẢN VAY (ONBOARDING)
**Mục đích:** Ghi nhận thông tin khách hàng, tài sản và chốt thỏa thuận tài chính.
- **Bước 1 (Nhận diện khách hàng):** Nhập Số Điện Thoại. Hệ thống tự động quét lịch sử, nếu là khách cũ tự động load Họ Tên. Nếu khách mới, yêu cầu nhập Họ Tên để khởi tạo hồ sơ (Customer Profile).
- **Bước 2 (Phân loại dịch vụ):** Chọn "TÍN CHẤP" hoặc "THẾ CHẤP". 
- **Bước 3 (Nhập thông tin tài sản - *Chỉ áp dụng Thế Chấp*):** 
  - Tạo danh sách gồm 1 hoặc N món tài sản.
  - Phân loại tài sản theo định dạng chuẩn: Xe máy / Ô tô / Bất động sản / Khác...
  - Ghi chú mô tả (Ví dụ: Đời xe, Biển số, Số khung, Tình trạng sổ đỏ...).
  - Định giá gốc (VNĐ) cho từng món. Hệ thống tự động **Cộng Dồn** giá trị các tài sản thành Tổng Số Tiền Vay gốc. (Nếu vay Tín Chấp, bỏ qua bước nhập tài sản và nhập tay số tiền vay).
- **Bước 4 (Chốt thỏa thuận tài chính):** 
  - Thống nhất Lãi suất (tính theo đơn vị VNĐ/1 Triệu/1 Ngày. Ví dụ: 1500đ, 2000đ).
  - Chọn Ngày Giải Ngân (Start Date).
- **Bước 5 (Ký kết):** Lưu dữ liệu xuống Database. Phần mềm phát tiếng thông báo thành công. In Hợp đồng văn bản (xuất file Word/PDF) để khách hàng và chủ ký tên sống.

## 3. QUY TRÌNH QUẢN TRỊ TRUY SỐ (LIFECYCLE & TRACKING)
Khoản vay bắt đầu tính ngày. Lợi nhuận (Profit) = Lãi suất * Số ngày * (Vốn/1.000.000). Luồng trạng thái sẽ nhảy tự động:
- **0 đến 26 ngày (Trạng Thái 'ĐANG CHỜ'):** Bình thường. Chủ tiệm có thể tra cứu lãi tạm tính tại bất cứ thời điểm nào. Mặc định vay rồi trả trong ngày (0 ngày) hoặc sau 1 ngày đều bị làm tròn thành tính lãi min (VD: Tối thiểu 2 ngày).
- **27 đến 29 ngày (Trạng Thái 'CẢNH BÁO'):** Hợp đồng sắp đến kỳ đóng lãi (30 ngày). Phần mềm tự động quăng Notification Popup để chủ tiệm chủ động liên hệ nhắc khách.
- **Tròn 30 ngày (Trạng Thái 'ĐẾN HẠN'):** Cảnh báo đến hạn.
- **Trên 30 ngày (Trạng Thái 'QUÁ HẠN'):** Nếu khách chưa đóng lãi, hệ thống đánh dấu Hợp đồng là nợ Xấu/Quá hạn, đẩy tự động chuyển Tab quản lý riêng ("Quá Hạn"). Liên tục thông báo cảnh báo.

## 4. QUY TRÌNH ĐÓNG LÃI TÁI KÝ (ROLLOVER)
Khách hàng đến hạn, chưa có tiền tất toán nhưng có tiền đóng lãi để gia hạn.
- **Bước 1:** Mở chi tiết hợp đồng, chọn "Tái ký / Đóng lãi". 
- **Bước 2:** Chọn "Ngày chốt lãi" (Mặc định hôm nay).
- **Bước 3:** Hệ thống tự động tính tổng tiền lãi phải đóng. Khách giao tiền.
- **Bước 4:** Bấm "Tái ký". 
- **Bước 5 (Logic hệ thống):** 
  - Hợp đồng cũ bị dập trạng thái thành "Đã xong" (Lưu vết lịch sử là đã thu ròng khoản lãi đó).
  - Tự động đẻ ra 1 Hợp đồng nhân bản y hệt với Ngày Bắt Đầu (Start Date) là ngày chốt lãi vừa qua. Bộ đếm ngày Reset về 0.

## 5. QUY TRÌNH TẤT TOÁN CHUỘC ĐỒ (CHECKOUT)
Khách hàng có khả năng trả tiền gốc.
- Tính tổng tiền = Tiền Vốn Đã Vay + Tiền Lãi (tính đến ngày chuộc).
- Khách giao tiền -> Trả lại điện thoại/xe máy/sổ đỏ cho khách.
- Chuyển trạng thái hợp đồng thành "ĐÃ XONG". Hợp đồng kết thúc.

## 6. QUY TRÌNH THANH LÝ, THU HỒI TÀI SẢN (LIQUIDATION)
Khách hàng bỏ của chạy lấy người, không thèm chuộc, gọi không nghe máy (Chỉ áp dụng cho đồ Thế Chấp).
- **Bước 1:** Chọn chức năng "Thanh Lý / Thu hồi". 
- **Bước 2 (Chờ Thanh Lý):** Nếu đồ chỉ mới đưa vào kho, chưa bán được ngay -> Chọn xác nhận đưa vào kho "Đang Thanh Lý". Hợp đồng chính thức cắt đứt với khách, trạng thái hợp đồng đổi vĩnh viễn thành "Thanh Lý". Toàn bộ tài sản bóc tách và nằm chờ trong kho Thanh Lý.
- **Bước 3 (Chốt Thanh Lý - PNL):** Khi chủ tiệm bán được tài sản đó cho người khác, mở lại kho. Nhập tay "Giá bán" thực tế của từng cụm tài sản + "Ngày bán".
- **Bước 4 (Hạch toán):** Hệ thống tính toán PNL (Lời/Lỗ) của pha thanh lý = Giá Bán Cuối - Giá Vốn Lúc Cầm. Ghi nhận tình trạng là "Đã Thanh Lý Xong".

## 7. QUY TRÌNH THEO DÕI TỔNG QUAN KHO TÀI SẢN (ASSET WAREHOUSE REPORTING)
Xây dựng Dashboard cung cấp Insight cho chủ doanh nghiệp:
- Quét và trích xuất mọi loại tài sản theo định dạng phân lớp: Mảng Xe máy, Mảng Ô tô, Mảng BĐS.
- Báo cáo 4 chỉ số tài chính của vạn vật:
  1. *Đã Từng Nhận:* Tổng Traffic tài sản vào tiệm.
  2. *Đang Cầm Trực Tiếp:* Những tài sản đang cầm máu thực tế trong kho chờ khách chuộc.
  3. *Đã Thanh Lý (Mất trắng ngừơi dùng).*
  4. *Đã trả khách (Giao dịch win-win).*
