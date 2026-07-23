# Trợ giảng Chính trị PTIT

Ứng dụng web hỗ trợ **giảng viên quản lý lớp học, học liệu và câu hỏi**; đồng thời giúp
**sinh viên tra cứu nội dung và hỏi đáp theo môn học** trong một luồng thống nhất.

## Trạng thái dự án

Dự án hiện ở giai đoạn **demo UI/UX hoàn chỉnh**:

- Trang chủ giới thiệu sản phẩm với hình ảnh từ các kênh chính thức của PTIT.
- Đăng nhập bằng tài khoản sinh viên hoặc giảng viên; hệ thống tự mở đúng không gian theo loại tài
  khoản, không yêu cầu chọn vai trò thủ công.
- Giao diện chatbot dành cho sinh viên có hội thoại, câu hỏi gợi ý và vùng hiển thị nguồn trích dẫn.
- Luồng sinh viên hỗ trợ theo dõi tiến độ, duyệt môn học, tra cứu, đặt câu hỏi và xem lịch sử.
- Luồng giảng viên hỗ trợ quản lý lớp, sinh viên, bài học, học liệu, hộp thư câu hỏi và hàng đợi kiểm
  duyệt.
- Backend Node.js cung cấp JSON API, SQLite persistence, session cookie HttpOnly, RBAC và audit log.

> **RAG chưa được tích hợp model/endpoint thật.** Nội dung AI hiện là fixture có nhãn demo để review
> giao diện, citation và quy trình kiểm duyệt. Model sẽ được kết nối sau khi UI/UX được duyệt.

## Công nghệ

| Lớp      | Công nghệ                                                          |
| -------- | ------------------------------------------------------------------ |
| Frontend | React 19, React Router 7, Vite 8, Lucide                           |
| Backend  | Node.js HTTP server                                                |
| Dữ liệu  | SQLite                                                             |
| Kiểm thử | Vitest, Testing Library, jsdom                                     |
| UI       | CSS custom properties, responsive layout, route-level lazy loading |

## Yêu cầu

- Node.js 24+
- npm 11+

## Chạy development

```bash
git clone https://github.com/24xNoVemBer/Chinh_tri_PTIT.git
cd Chinh_tri_PTIT
npm install
npm run dev
```

`npm run dev` khởi động đồng thời:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api`
- SQLite mặc định: `data/ptit-teaching-assistant.sqlite`

Có thể sao chép `.env.example` thành `.env` trước khi chạy để thay đổi cấu hình.

## Tài khoản demo

| Vai trò    | Email                 | Mật khẩu       |
| ---------- | --------------------- | -------------- |
| Sinh viên  | `tuananh@ptit.edu.vn` | `Student@123`  |
| Giảng viên | `ductu@ptit.edu.vn`   | `Lecturer@123` |

Các tài khoản seed chỉ phục vụ development và review cục bộ.

## Biến môi trường

| Biến               | Mặc định                              | Mô tả                                                           |
| ------------------ | ------------------------------------- | --------------------------------------------------------------- |
| `PORT`             | `3001`                                | Cổng HTTP của backend                                           |
| `DATABASE_PATH`    | `data/ptit-teaching-assistant.sqlite` | Đường dẫn file SQLite                                           |
| `NODE_ENV`         | `development`                         | Môi trường chạy                                                 |
| `VITE_DATA_SOURCE` | `api`                                 | Dùng `api` cho backend thật hoặc `mock` cho repository mô phỏng |
| `RAG_DEMO_DATA`    | `true`                                | Đặt `false` để không seed dữ liệu RAG demo                      |

## Build production cục bộ

```bash
npm run build
npm start
```

Backend phục vụ cả API và thư mục `dist` tại `http://127.0.0.1:3001`.

## Kiểm tra chất lượng

```bash
npm run check
```

Lệnh trên chạy tuần tự Prettier, ESLint, Vitest và production build. Bộ kiểm thử hiện có **27 test
trong 4 test files**, bao phủ session, RBAC, các vertical slice chính, audit log, SQLite persistence
và giao diện chatbot demo.

Có thể chạy riêng từng bước:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

## Cấu trúc chính

```text
server/                 HTTP API, session, SQLite schema/seed và backend repositories
src/
  assets/               Hình ảnh dùng trong giao diện
  components/           Component dùng chung
  features/auth/        Auth provider và role guard
  layouts/              Layout sinh viên và giảng viên
  pages/                Home, đăng nhập, chatbot và các màn hình nghiệp vụ
  services/             API client và repositories
  styles/               Design tokens và global styles
design-system/          Source of truth cho UI
docs/                   API, database và frontend contracts
```

## Tài liệu

- [Kế hoạch dự án](./PROJECT_PLAN.md)
- [API](./docs/API.md)
- [SQLite schema](./docs/DATABASE.md)
- [Frontend contracts](./docs/FRONTEND_CONTRACTS.md)
- [Design system](./design-system/ptit-teaching-assistant/MASTER.md)

## Nguồn hình ảnh

Các ảnh PTIT trên trang chủ được lưu cục bộ để bảo đảm preview ổn định. URL nguồn từ
[ptit.edu.vn](https://ptit.edu.vn/) và [student.ptit.edu.vn](https://student.ptit.edu.vn/) được giữ
trong `HomePage.jsx` để đội dự án đối chiếu khi kiểm duyệt nội dung.
