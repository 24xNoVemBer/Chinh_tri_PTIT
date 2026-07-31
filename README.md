# PTIT Chính Trị

Nền tảng học tập các học phần lý luận chính trị dành cho sinh viên PTIT, tích hợp không gian quản lý lớp học dành cho giảng viên và giao diện AI trợ giảng để tra cứu, hỏi đáp theo đúng ngữ cảnh môn học.

## Mục tiêu

- Giúp **sinh viên** theo dõi tiến độ, học theo từng học phần, tra cứu học liệu, đặt câu hỏi và ôn tập có hệ thống.
- Giúp **giảng viên** quản lý lớp, sinh viên, bài học, tài liệu và hàng đợi câu hỏi trong một giao diện thống nhất.
- Chuẩn bị sẵn lớp giao diện và quy trình kiểm duyệt để tích hợp mô hình RAG sau khi UI/UX được nghiệm thu.

## Trạng thái hiện tại

Dự án đang ở giai đoạn **demo UI/UX hoàn chỉnh** với backend cục bộ phục vụ luồng nghiệp vụ:

- Trang giới thiệu theo định hướng PTIT, có motion, khung trình chiếu học phần và hình ảnh lịch sử phù hợp từng môn.
- Trang đăng nhập tự xác định luồng sinh viên hoặc giảng viên từ loại tài khoản; người dùng không chọn vai trò thủ công.
- Thanh điều hướng trên cùng, responsive cho cả hai không gian làm việc.
- Dashboard sinh viên theo hướng Action-first, có việc học ưu tiên, bài tiếp theo theo học phần, phản hồi chính thức và trợ giảng theo ngữ cảnh.
- Dashboard giảng viên có công việc cần xử lý, thống kê lớp, mức độ tham gia, tiến độ và hoạt động gần đây.
- Bìa học phần và hình minh họa theo đúng nội dung Triết học Mác – Lênin, Kinh tế chính trị, Tư tưởng Hồ Chí Minh và Lịch sử Đảng.
- Chatbot demo gửi câu hỏi theo học phần qua backend, lưu request/response/citation vào SQLite và
  đưa cùng câu trả lời vào hàng đợi kiểm duyệt của giảng viên.
- Câu trả lời được phân loại minh bạch thành ưu tiên cao, cần xem xét hoặc kiểm tra lấy mẫu để
  giảng viên tập trung vào ngoại lệ thay vì phải duyệt toàn bộ.
- Backend Node.js cung cấp JSON API, SQLite persistence, session cookie HttpOnly, RBAC và audit log.

> [!IMPORTANT]
> **Mô hình RAG chưa được kết nối.** Chat API hiện tạo nội dung demo có nhãn chưa kiểm duyệt để
> kiểm tra trọn luồng frontend, backend, SQLite, citation và review queue. Model và retrieval thật
> sẽ được tích hợp sau.

## Luồng chức năng

### Sinh viên

- Tiếp tục bài học gần nhất và theo dõi tiến độ.
- Duyệt học phần, chương, bài học và nội dung ôn tập.
- Tra cứu giáo trình, văn kiện và nguồn tham khảo.
- Đặt câu hỏi theo môn học; xem lịch sử và phản hồi của giảng viên.
- Truy cập chatbot AI trợ giảng ở chế độ demo.

### Giảng viên

- Theo dõi tình hình lớp và các chỉ số cần chú ý.
- Quản lý lớp học, danh sách sinh viên và trạng thái tham gia.
- Lên lịch bài học, gắn học liệu và quản lý phiên bản tài liệu.
- Tiếp nhận, trả lời và lọc câu hỏi theo lớp hoặc học phần.
- Kiểm duyệt câu trả lời RAG demo trước khi công bố.

## Công nghệ

| Lớp      | Công nghệ                                                          |
| -------- | ------------------------------------------------------------------ |
| Frontend | React 19, React Router 7, Vite 8, Lucide                           |
| Backend  | Node.js HTTP server                                                |
| Dữ liệu  | SQLite                                                             |
| Xác thực | Session cookie HttpOnly, RBAC                                      |
| Kiểm thử | Vitest, Testing Library, jsdom                                     |
| UI       | CSS custom properties, responsive layout, route-level lazy loading |

## Yêu cầu

- Node.js 24+
- npm 11+

## Cài đặt và chạy development

```bash
git clone https://github.com/24xNoVemBer/Chinh_tri_PTIT.git
cd Chinh_tri_PTIT
npm install
npm run dev
```

`npm run dev` khởi động đồng thời:

- Frontend: `http://localhost:5173` (Vite bind theo `localhost`; `127.0.0.1:5173` sẽ không kết nối được)
- API: `http://127.0.0.1:3001/api`
- SQLite mặc định: `data/ptit-teaching-assistant.sqlite`

Sao chép `.env.example` thành `.env` nếu cần thay đổi cấu hình mặc định.

## Tài khoản demo

| Vai trò    | Email                 | Mật khẩu       |
| ---------- | --------------------- | -------------- |
| Sinh viên  | `tuananh@ptit.edu.vn` | `Student@123`  |
| Giảng viên | `ductu@ptit.edu.vn`   | `Lecturer@123` |

Các tài khoản trên chỉ phục vụ development và review cục bộ. Chúng **không** được tạo khi
`NODE_ENV=production`, và hai nút điền nhanh trên trang đăng nhập bị loại khỏi bundle production.

## Biến môi trường

| Biến               | Mặc định                              | Mô tả                                                                        |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| `PORT`             | `3001`                                | Cổng HTTP của backend                                                        |
| `HOST`             | `127.0.0.1`                           | Địa chỉ bind; đặt `0.0.0.0` khi chạy trong container                         |
| `DATABASE_PATH`    | `data/ptit-teaching-assistant.sqlite` | Đường dẫn file SQLite                                                        |
| `NODE_ENV`         | `development`                         | Môi trường chạy                                                              |
| `TRUSTED_ORIGINS`  | _(trống)_                             | Danh sách origin được phép đổi dữ liệu, chặn CSRF. **Bắt buộc ở production** |
| `VITE_DATA_SOURCE` | `api`                                 | Dùng `api` cho backend hoặc `mock` cho repository mô phỏng                   |
| `RAG_DEMO_DATA`    | `true`                                | Đặt `false` để không seed dữ liệu RAG demo                                   |
| `SEED_DEMO_DATA`   | _(trống)_                             | Chỉ đặt `true` nếu cố ý tạo tài khoản demo trên production                   |

## Build production cục bộ

```bash
npm run build
npm start
```

Backend phục vụ API và thư mục `dist` tại `http://127.0.0.1:3001`.

## Triển khai production

```bash
NODE_ENV=production TRUSTED_ORIGINS=https://ten-mien-cua-ban npm start
```

`TRUSTED_ORIGINS` là bắt buộc và server sẽ **từ chối khởi động** nếu thiếu. Lý do: khi đứng
sau reverse proxy, header `Host` mà backend nhận được là địa chỉ upstream chứ không phải tên
miền người dùng truy cập, nên nếu suy ra origin từ `Host` thì mọi request thay đổi dữ liệu sẽ
bị chặn — hỏng toàn bộ ứng dụng với nguyên nhân rất khó lần ra. Ghi đủ scheme, không có dấu
`/` ở cuối, nhiều origin thì phân tách bằng dấu phẩy.

Ở development có thể để trống: mọi origin loopback (`localhost`, `127.0.0.1`) được tin cậy để
Vite dev server proxy được sang API.

## Kiểm tra chất lượng

Chạy toàn bộ quy trình kiểm tra:

```bash
npm run check
```

Lệnh này chạy lần lượt Prettier, ESLint, Vitest và production build. Bộ kiểm thử hiện có **55 test trong 9 test files**, bao phủ session, RBAC, các vertical slice chính, audit log, SQLite persistence, giao diện chatbot demo, luồng chatbot sang hàng đợi kiểm duyệt, phân loại ưu tiên, cùng các test hồi quy cho phân quyền nội dung (bài học nháp, cổng kiểm duyệt RAG, phạm vi câu hỏi), giao diện lịch sử hỏi đáp và chống lạm dụng (rate limit đăng nhập, CSRF, giới hạn độ dài input).

Có thể chạy riêng từng bước:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

## Cấu trúc dự án

```text
server/                 HTTP API, session, SQLite schema/seed và repositories
src/
  assets/               Ảnh học phần, ảnh dashboard và thông tin nguồn
  components/common/    Navigation, progress, course cover và component dùng chung
  features/auth/        Auth provider và role guard
  layouts/              Layout sinh viên và giảng viên
  pages/auth/            Đăng nhập theo tài khoản
  pages/common/          Trang chủ và CSS dùng chung cho dashboard
  pages/student/         Học phần, bài học, tra cứu, hỏi đáp và chatbot
  pages/lecturer/        Lớp học, sinh viên, học liệu, câu hỏi và kiểm duyệt
  services/              API client và repositories
  styles/                Design tokens và global styles
design-system/           Source of truth cho UI
docs/                    API, database và frontend contracts
```

## Tài liệu

- [Ý tưởng và cơ sở định hướng sản phẩm](./IDEA.md)
- [Kế hoạch dự án](./PROJECT_PLAN.md)
- [API](./docs/API.md)
- [SQLite schema](./docs/DATABASE.md)
- [Frontend contracts](./docs/FRONTEND_CONTRACTS.md)
- [Design system](./design-system/ptit-teaching-assistant/MASTER.md)

## Nguồn hình ảnh

Hình ảnh được lưu cục bộ để bảo đảm bản demo ổn định. Thông tin nguồn và giấy phép được ghi tại:

- [Ảnh trình chiếu học phần](./src/assets/COURSE_SHOWCASE_ATTRIBUTION.md)
- [Ảnh bìa học phần](./src/assets/courses/ATTRIBUTION.md)
- [Ảnh minh họa dashboard](./src/assets/dashboard/ATTRIBUTION.md)

Các ảnh PTIT còn lại được sử dụng cho mục đích minh họa và sẽ tiếp tục được đội dự án kiểm duyệt trước khi phát hành chính thức.

## Repository

[github.com/24xNoVemBer/Chinh_tri_PTIT](https://github.com/24xNoVemBer/Chinh_tri_PTIT)
