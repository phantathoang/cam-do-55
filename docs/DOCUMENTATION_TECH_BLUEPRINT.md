# TECHNICAL BLUEPRINT - KIẾN TRÚC & PHÁT TRIỂN ỨNG DỤNG CẦM ĐỒ

Tài liệu thiết kế kiến trúc kỹ thuật (Technical Blueprint) để xây dựng ứng dụng Desktop Quản Trị Cầm Đồ. Bộ tài liệu có thể tham chiếu tái sử dụng (Skill) cho việc build hàng loạt các ứng dụng SaaS, quản lý tài khoá, ERP cá nhân trong tương lai.

## 1. TECH STACK VÀ KIẾN TRÚC FRONTEND/BACKEND

### Core Engine (Native Desktop Wrapper)
- **Tauri v2:** Thay thế Electron bằng Tauri (Rust) để đóng gói ứng dụng. Lý do: Dung lượng sau build bằng 1/10 Electron, RAM sử dụng ~30MB (Native Webview thay vì Chromium nhúng), tốc độ khởi động < 1 giây, bảo mật cao. Đảm bảo UI mượt như app Native MacOS/Windows.
- **Permission & Capabilities:** Tauri v2 sử dụng ACL chặt chẽ. Cần cấp quyền JSON explicitly cho việc đọc ghi DB (fs, sql) và gọi Notification OS (`tauri-plugin-notification`).

### Frontend (User Interface)
- **Framework:** React 19 + TypeScript build qua Vite. 
- **Styling:** Vanilla TailwindCSS + Tailwind Animate. Không lạm dụng Headless UI/Component libraries nặng nề (như MUI, AntD). Mọi Component (Modal, Dropdown, Tabs) được **Custom-built** để tạo ra giao diện Premium, Tối Giản, và có độ tinh chỉnh cá nhân hóa tuyệt đối.
- **Quản lý State Toàn cục (Global State):** Dùng `Zustand`. Thay thế Redux quá cồng kềnh. Zustand gom 1 file `store.ts` xử lý mọi tác vụ Data Fetching, CRUD và caching Logic. 

### Database (Data Persistence)
- **SQLite (qua `tauri-plugin-sql` hoặc Native local implementation):** Lưu Data Offline 100% trên máy người dùng, Zero-latency (Chạy nội bộ không độ trễ, không sợ đứt mạng, không lo bảo mật cloud lộ dữ liệu khách hàng).
- Lưu trữ Array/Mảng Tài sản phức tạp bằng phương thức `JSON.stringify` vào column dạng TEXT của SQLite. Khi lấy ra thì `JSON.parse`. (Giải pháp nhanh gọn cho RDBMS nhỏ).

---

## 2. TRIẾT LÝ UX/UI (USER EXPERIENCE)

**Nguồn cảm hứng:** Hệ điều hành MacOS, Giao diện Core-banking, Dashboard quản trị Web3 cao cấp. Yêu Cầu Giao Diện Phải Gây Được Tiếng **WOW**.

- **Tone Màu (Dark Mode Premium):** 
  - Nền tổng thể: `bg-slate-950` (Đen xanh sâu).
  - Khối giao diện: `bg-slate-900 / bg-slate-800` với `backdrop-blur` (hiệu ứng kính mờ Glassmorphism).
  - Tín hiệu màu thị giác (Accents): `emerald-500` (Xanh ngọc - Sinh lời/Hành động chính), `blue-400` (Thông tin), `amber-500` (Cam - Cảnh báo/Thanh lý), `rose-400` (Đỏ - Rủi ro, Xóa).
  - Text Typography: Trắng tinh (`text-white`), Xám khói (`text-slate-400`) để làm dịu mắt, có thể xài Font Mono để hiển thị số Tiền (Đồng nhất bề ngang số).

- **Hiệu ứng Micro-Animations (App Sống Động):**
  - Mọi cửa sổ bật lên (Modal) KHÔNG pop khô khan mà phải có `animate-in fade-in zoom-in-95 duration-200`.
  - Mọi action (Hover chuột) vào button, icon đều có thay đổi màu border, phát ra vầng sáng nhẹ sau lưng (`shadow-[0_0_15px...`). Hover vào chip/badge có hiệu ứng `scale-110`.
  
- **Layout luồng thao tác (Zero-Page-Reload Workflow):**
  - App là một Single-page Application vĩnh viễn (0 độ trễ). Toàn bộ form chức năng, sửa xóa được nhúng thẳng vào các **Popup Modal** hoặc **Slide-down Form** ở cùng trang `App.tsx`. 
  - Right-click Menu (Context Menu) tuỳ chỉnh thay cho thao tác bấm rườm rà. Nút X (Đóng) luôn chốt ở mép phải trên cùng của các Modal.

---

## 3. LOGIC XỬ LÝ KỸ THUẬT QUAN TRỌNG

### 3.1. Background Cronjobs & System Notifications (Hệ Thống Cảnh Báo Ngầm)
- **Kỹ thuật Trigger:** Xài một lệnh `.setInterval` ở layer UI gốc (`App.tsx`) chạy mỗi 5 phút một lần để gọi hàm `fetchData()`.
- **Logic Quét Notification:** 
  - Bên trong `fetchData()`, lặp toàn bộ mảng `contracts` có trạng thái Đang Chờ/Quá Hạn. 
  - Tính hàm `calculateDays()`. Ép Date của DB và Date hiện tại về chung 1 chuẩn 0h:00m:00s để trừ Days ra số nguyên chính xác.
  - Vượt rule (27-29 ngày, 30 ngày, >30 ngày) -> Bắn `pushSystemNotification` vào thẳng API hệ điều hành.
  - **Kỹ Thuật Chống Spam:** Khởi tạo biến `const notifiedAlerts = new Set<string>()` nằm ngoài React Cycle. Lưu trữ định danh (VD: `overdue_15`) dập spam thông báo trùng lặp.

### 3.2. Data Export & Trích xuất File Word (DocxTemplater)
- **Vấn đề:** Muốn app tự điền thông tin ra biểu mẫu Word để đi in mà không cần mở MS Word chỉnh bằng tay.
- **Thư viện:** Dùng `docxtemplater` ghép với `pizzip`. 
- **Quy trình:**
  - Ném form mẫu `template.docx` vào folder `public/`.
  - Front-end Fetch file dưới dạng `arraybuffer`. Đẩy vào `PizZip`. 
  - Trích lập các Tag trong file theo syntax `{TEN_KHACH_HANG}` -> Render ra Blob -> Lưu trực tiếp hoặc xuất Download URL giả qua thẻ `<a>`.
  - Tạo `ContractPrintView` overlay giao diện để gọi thẳng lệnh `window.print()` lấy file PDF/in giấy cực lẹ.

### 3.3. Module Hóa Component & Prop Drilling
- Để luồng code không rối tung khi vượt qua 1000 lines. Mã được cắt lớp:
  - `App.tsx` (Grid Layout & Main States).
  - `ContractList.tsx` (Render toàn bộ list card. Chứa cả Inline Modals cho các action thuộc về card -> Gom cục logic lại không làm rác App.tsx).
  - `ContractForm.tsx` (Form thêm Hợp đồng khổng lồ, xử lý Array Manipulation cho việc Add/Remove block Tài sản thế chấp).
  - `store.ts` (API/DB Adapter Call & Caching rules).
  - `db.ts` (Native Query Syntax, thuần SQL hoặc wrapper SQLite).

## 4. BÀI HỌC ÁP DỤNG MỞ RỘNG TƯƠNG LAI
*   Kiến trúc này Cực Kỳ Fit cho: Phần mềm Quản lý Kho, ERP, CRM siêu mượt, App kế toán nhỏ, Quản lý Khách Sạn nội bộ,... Việc bê nguyên xi System Notifications, Database Local, Form + Modal Handling qua ứng dụng khác mất không tới 2 giờ thiết lập.
*   Công nghệ Tauri kết nối React xứng đáng để đập bỏ Electron vĩnh viễn nhờ khả năng tối ưu hóa nhị phân lõi tuyệt vời cùng sức mạnh JS Frontend linh hoạt vô tận.
