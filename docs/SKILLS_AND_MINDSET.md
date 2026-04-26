# 🧠 CẨM NANG KỸ NĂNG VÀ TƯ DUY PHÁT TRIỂN (SKILLS & MINDSET)

Tài liệu này đúc kết những tư duy cốt lõi và kỹ năng thực chiến (Best Practices) để xây dựng ứng dụng Cầm Đồ 55 đạt chuẩn Production-Ready. Đây là bộ khung tư duy được đúc kết từ môi trường làm việc của các BigTech (Apple, Google, Microsoft) và các công ty Fintech hàng đầu.

---

## 1. TƯ DUY HỆ THỐNG THEO CHUẨN BIGTECH (SYSTEMS THINKING)

### 1.1. Zero-Trust & Privacy First (Bảo mật tuyệt đối)
- **Vấn đề:** Các ứng dụng tài chính nội bộ chứa dữ liệu PII (Personal Identifiable Information) rất nhạy cảm của khách hàng.
- **Tư duy BigTech:** Không bao giờ tin tưởng môi trường Web/Cloud nếu không cần thiết. Đẩy toàn bộ dữ liệu về **Local (Offline-First)**. Khách hàng tự giữ Data của mình.
- **Thực hành:** Sử dụng SQLite cục bộ thay vì Firebase/PostgreSQL. Mã hóa (Encrypt) CCCD, Số điện thoại ngay từ lúc nhập liệu bằng Master Key sinh ngẫu nhiên và lưu ở tầng OS File System (thay vì LocalStorage mỏng manh).

### 1.2. Tính module hóa và Khả năng mở rộng (Scalability)
- **Vấn đề:** Ứng dụng phình to sẽ trở thành một mớ "Spaghetti Code".
- **Tư duy BigTech:** Xây dựng hệ thống như các khối Lego. Tách biệt rõ ràng tầng Giao diện (UI) - Logic Trạng thái (State) - Tương tác dữ liệu (Repository/Database).
- **Thực hành:** Tách riêng `ContractRepository` để lo DB, `store.ts` để lo Global State, và Component UI chỉ làm nhiệm vụ "Hiển thị" (Dumb Components).

### 1.3. Fault Tolerance & Graceful Degradation (Chống chịu lỗi)
- **Vấn đề:** App có thể bị sập nếu dữ liệu cũ trong DB bị sai định dạng hoặc lỗi kết nối thư viện.
- **Tư duy BigTech:** Hệ thống phải bắt được lỗi, không được Crash ứng dụng (Trắng màn hình).
- **Thực hành:** Dùng `try...catch` ở mọi lời gọi DB. Nếu lỗi, hiển thị Toast Notification báo cho người dùng biết thay vì treo App. Các Fallback UI (Ví dụ: `Không có dữ liệu` được thiết kế đẹp mắt) thay vì khoảng trắng.

---

## 2. TƯ DUY LẬP TRÌNH VÀ KIẾN TRÚC CODE (CODE CRAFTSMANSHIP)

### 2.1. Nỗi ám ảnh về sự sạch sẽ (Clean Code)
- Không có mã thừa, không có biến không sử dụng (Sử dụng công cụ rà soát như `Knip`, `Depcheck` để thanh lọc project).
- Đặt tên hàm và biến mang tính tự giải thích (Self-explanatory). Ví dụ: Thay vì `calc()`, hãy dùng `calculateProfit()`; Thay vì `get()`, hãy dùng `fetchContracts()`.

### 2.2. Tránh "Re-inventing the wheel" một cách ngu ngốc
- Không viết lại những thứ framework đã làm quá tốt. Thay vì dùng `useState` lắt nhắt truyền Prop Drilling qua 5 Component, hãy đưa lên Global Store với Zustand.
- Tận dụng `useMemo` và `useCallback` để cache lại các phép toán nặng (Ví dụ: vòng lặp tính tổng lợi nhuận của 10.000 hợp đồng).

### 2.3. Asynchronous Mastery (Kiểm soát Bất đồng bộ)
- Thấu hiểu cơ chế Event Loop của Javascript. Các tác vụ đọc/ghi File, SQLite qua Tauri v2 (Rust) phải được `await` cẩn thận để tránh Race Conditions (Luồng này ghi đè luồng kia).

---

## 3. TƯ DUY THIẾT KẾ UI/UX (FINTECH AESTHETICS)

### 3.1. "Vibe Coding" & Cảm quan cao cấp (Premium Feel)
- **Tư duy:** Một phần mềm B2B/Tài chính không có nghĩa là phải xấu xí như Excel thời 2000. Giao diện đẹp sẽ tạo ra "Niềm tin" và "Cảm hứng" làm việc cho người dùng.
- **Màu sắc:** Sử dụng bảng màu Dark Mode cao cấp (Deep Slate, Emerald, Violet) giống Linear, Vercel, Stripe. Hạn chế dùng màu nguyên bản (Mã màu #FF0000), phải pha một chút xám để không gắt mắt.

### 3.2. Chăm chút Micro-Interactions (Tương tác siêu nhỏ)
- Mọi nút bấm đều phải có phản hồi thị giác: Hover đổi màu nền, Click thì chìm xuống (`active:scale-95`), focus thì có viền sáng (`ring-2`).
- Ứng dụng các thư viện Animation siêu nhẹ (`tailwindcss-animate`) để các Modal xuất hiện kiểu fade-in-zoom thay vì đập vào mắt người dùng một cách thô bạo.

### 3.3. Zero Layout Shifts & Empty States
- **Không bao giờ** để giao diện nhảy giật cục khi dữ liệu đang load hoặc bị rỗng.
- **Empty States (Trạng thái Rỗng):** Thiết kế tỉ mỉ box "Không có dữ liệu" với kích thước cố định (`min-h-[140px]`), icon mờ ảo (`opacity-20`). Đừng bao giờ quăng một chữ "Null" hoặc một mảng trắng tinh cho người dùng.

---

## 4. TƯ DUY SẢN PHẨM (PRODUCT MANAGEMENT MINDSET)

- **Nguyên lý 80/20:** Tập trung 80% effort vào 20% tính năng cốt lõi (Tạo hợp đồng nhanh, In File Word chuẩn xác, Theo dõi dòng tiền). Không làm những tính năng "có thì vui" rườm rà.
- **Continuous Refactoring:** Liên tục đập đi xây lại những đoạn code bốc mùi (Code smells). Đừng ngại xoá code. "Less code is better code".
- **Lấy người dùng làm trung tâm (User-Centric):** Thiết kế form nhập liệu sao cho có thể dùng phím `Tab` và `Enter` chuyển dòng nhanh như máy POS, phục vụ thao tác của dân tài chính cần sự nhanh gọn.
