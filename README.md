# PTIT Chính Trị

Nền tảng học tập các học phần lý luận chính trị dành cho sinh viên PTIT, tích hợp không gian quản lý lớp học dành cho giảng viên và giao diện AI trợ giảng để tra cứu, hỏi đáp theo đúng ngữ cảnh môn học.

## Mục tiêu

- Giúp **sinh viên** theo dõi tiến độ, học theo từng học phần, tra cứu học liệu, đặt câu hỏi và ôn tập có hệ thống.
- Giúp **giảng viên** quản lý lớp, sinh viên, bài học, tài liệu và hàng đợi câu hỏi trong một giao diện thống nhất.
- Chuẩn bị sẵn lớp giao diện và quy trình kiểm duyệt để tích hợp mô hình RAG sau khi UI/UX được nghiệm thu.

## Trạng thái hiện tại

**Plan A quản trị môn học và lớp tín chỉ đã hoàn thành ở mức code và development.** Backend hiện
hỗ trợ ba role `admin`, `lecturer`, `student`; PostgreSQL staging thật vẫn cần credential và hạ tầng
PTIT để chạy cutover, tải và restore drill:

- Trang giới thiệu theo định hướng PTIT, có motion, khung trình chiếu học phần và hình ảnh lịch sử phù hợp từng môn.
- Trang đăng nhập tự xác định luồng sinh viên hoặc giảng viên từ loại tài khoản; người dùng không chọn vai trò thủ công.
- Thanh điều hướng trên cùng, responsive cho cả hai không gian làm việc.
- Dashboard sinh viên có bài học gần nhất, tiến độ, thống kê động, danh sách học phần và câu hỏi gần đây.
- Dashboard giảng viên có công việc cần xử lý, thống kê lớp, mức độ tham gia, tiến độ và hoạt động gần đây.
- Bìa học phần và hình minh họa theo đúng nội dung Triết học Mác – Lênin, Kinh tế chính trị, Tư tưởng Hồ Chí Minh và Lịch sử Đảng.
- Chatbot demo gửi câu hỏi theo học phần qua backend, lưu request/response/citation vào database runtime và
  đưa cùng câu trả lời vào hàng đợi kiểm duyệt của giảng viên.
- Câu trả lời được phân loại minh bạch thành ưu tiên cao, cần xem xét hoặc kiểm tra lấy mẫu để
  giảng viên tập trung vào ngoại lệ thay vì phải duyệt toàn bộ.
- Backend Node.js cung cấp JSON API, runtime SQLite/PostgreSQL, session cookie HttpOnly, RBAC,
  rate limit đăng nhập dùng chung giữa các instance và audit log.
- Admin quản lý tài khoản, môn, học kỳ, lớp tín chỉ, phân công nhiều giảng viên, nội dung dùng
  chung và nhật ký hệ thống.
- Giảng viên quản lý ngân hàng câu hỏi riêng theo lớp được phân công, nhận hàng đợi hỏi đáp chung
  và xem thống kê tách biệt cho từng lớp tín chỉ.

> [!IMPORTANT]
> **Mô hình RAG chưa được kết nối.** Chat API hiện tạo nội dung demo có nhãn chưa kiểm duyệt để
> kiểm tra trọn luồng frontend, backend, database, citation và review queue. Model và retrieval thật
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

## Luyện tập trắc nghiệm

MVP đã có ngân hàng câu hỏi dùng chung theo học phần. Giảng viên nhập thủ công câu hỏi A–D, chọn đáp án đúng, thêm giải thích rồi lưu nháp hoặc xuất bản. Sinh viên chọn học phần/chương, làm từng câu và nhận đáp án cùng giải thích ngay sau khi chọn.

Chi tiết API, schema và hướng mở rộng Excel/Word nằm trong [docs/PRACTICE_QUESTION_BANK.md](./docs/PRACTICE_QUESTION_BANK.md).

## Công nghệ

| Lớp      | Công nghệ                                                          |
| -------- | ------------------------------------------------------------------ |
| Frontend | React 19, React Router 7, Vite 8, Lucide                           |
| Backend  | Node.js HTTP server                                                |
| Dữ liệu  | SQLite cho development; PostgreSQL cho staging/production          |
| Xác thực | Session cookie HttpOnly, RBAC, shared login rate limit             |
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

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api`
- SQLite mặc định: `data/ptit-teaching-assistant.sqlite`

Sao chép `.env.example` thành `.env` nếu cần thay đổi cấu hình mặc định. Với staging, dùng `.env.staging.example` làm checklist rồi nạp secret thật vào `.env` hoặc secret manager; các script không tự load file mẫu.

## Tài khoản demo

| Vai trò    | Email                 | Mật khẩu       |
| ---------- | --------------------- | -------------- |
| Admin      | `admin01@ptit.edu.vn` | `Admin@123`    |
| Sinh viên  | `tuananh@ptit.edu.vn` | `Student@123`  |
| Giảng viên | `ductu@ptit.edu.vn`   | `Lecturer@123` |

Các tài khoản trên chỉ phục vụ development và review cục bộ.

Để nạp bộ demo đầy đủ gồm 52 tài khoản, 10 lớp tín chỉ và dữ liệu luyện tập/hỏi đáp:

```bash
npm run db:seed:demo -- --confirm-demo-seed
```

Danh sách toàn bộ tài khoản và mật khẩu nằm tại
[docs/DEMO_ACCOUNTS.md](./docs/DEMO_ACCOUNTS.md). Seed chạy lặp lại không nhân bản và bị khóa hoàn
toàn khi `NODE_ENV=production`.

## Biến môi trường

| Biến                                      | Mặc định                              | Mô tả                                                                            |
| ----------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `HOST`                                    | `127.0.0.1`                           | Địa chỉ backend lắng nghe; dùng `0.0.0.0` khi đặt sau container/reverse proxy    |
| `PORT`                                    | `3001`                                | Cổng HTTP của backend                                                            |
| `DATABASE_PATH`                           | `data/ptit-teaching-assistant.sqlite` | Đường dẫn file SQLite                                                            |
| `DATABASE_DRIVER`                         | `sqlite`                              | Adapter: `sqlite` hoặc `postgres`; PostgreSQL cần migrate schema trước khi start |
| `DATABASE_URL`                            | _(trống)_                             | PostgreSQL connection string khi dùng adapter postgres                           |
| `DATABASE_SSL_MODE`                       | `disable`                             | `verify-full` bắt buộc cho PostgreSQL production                                 |
| `DATABASE_SSL_CA_PATH`                    | _(trống)_                             | Đường dẫn CA tin cậy; file secret không commit vào Git                           |
| `DATABASE_CONFIRM_HOST`                   | _(trống)_                             | Host và port phải khớp DATABASE_URL trước tác vụ quản trị PostgreSQL             |
| `DATABASE_CONFIRM_NAME`                   | _(trống)_                             | Tên database phải khớp DATABASE_URL                                              |
| `DATABASE_CONFIRM_USER`                   | _(trống)_                             | User phải khớp URL và current_user do PostgreSQL báo cáo                         |
| `DATABASE_ALLOW_PRODUCTION_ADMIN`         | `false`                               | Break-glass cho target production; staging bình thường phải giữ false            |
| `DATABASE_POOL_MAX`                       | `10`                                  | Số connection tối đa cho PostgreSQL pool                                         |
| `DATABASE_IDLE_TIMEOUT_MS`                | `10000`                               | Thời gian connection PostgreSQL idle trước khi đóng (ms)                         |
| `DATABASE_CONNECTION_TIMEOUT_MS`          | `5000`                                | Giới hạn thời gian mở connection PostgreSQL (ms)                                 |
| `DATABASE_QUERY_TIMEOUT_MS`               | `20000`                               | Giới hạn chờ query ở client; phải lớn hơn statement timeout (ms)                 |
| `DATABASE_STATEMENT_TIMEOUT_MS`           | `15000`                               | Giới hạn thực thi statement runtime ở PostgreSQL (ms)                            |
| `DATABASE_ADMIN_QUERY_TIMEOUT_MS`         | `125000`                              | Client timeout cho migration/import/validation (ms)                              |
| `DATABASE_ADMIN_STATEMENT_TIMEOUT_MS`     | `120000`                              | Server statement timeout cho tác vụ database quản trị (ms)                       |
| `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS` | `10000`                               | Đóng transaction bị bỏ quên (ms)                                                 |
| `DATABASE_APPLICATION_NAME`               | `ptit-politics-api`                   | Tên ứng dụng hiển thị trong `pg_stat_activity`                                   |
| `AUTH_RATE_LIMIT_ENABLED`                 | `true`                                | Bảo vệ login; bắt buộc bật trong production                                      |
| `AUTH_TRUST_PROXY`                        | `false`                               | Chỉ tin X-Forwarded-For khi proxy PTIT ghi đè header                             |
| `AUTH_LOGIN_WINDOW_MS`                    | `900000`                              | Cửa sổ tính lượt đăng nhập                                                       |
| `AUTH_LOGIN_BLOCK_MS`                     | `900000`                              | Thời gian chặn sau khi vượt ngân sách                                            |
| `AUTH_LOGIN_ACCOUNT_MAX`                  | `20`                                  | Ngân sách trên tài khoản trong một cửa sổ                                        |
| `AUTH_LOGIN_SOURCE_ACCOUNT_MAX`           | `5`                                   | Ngân sách trên cặp nguồn–tài khoản                                               |
| `AUTH_LOGIN_CLEANUP_INTERVAL_MS`          | `300000`                              | Chu kỳ dọn trạng thái rate limit hết hạn                                         |
| `DB_SNAPSHOT_PATH`                        | _(trống)_                             | Snapshot staging-safe dùng cho import và exact validation                        |
| `DB_ALLOW_EXISTING_IMPORT`                | `false`                               | Xác nhận thứ hai khi dùng break-glass --allow-existing                           |
| `DB_ALLOW_RUNTIME_DATA_IMPORT`            | `false`                               | Xác nhận thứ hai khi import session/audit runtime                                |
| `STAGING_CREDENTIAL_ROTATION_CONFIRM`     | `false`                               | Chỉ bật sau khi import và đối chiếu snapshot staging                             |
| `STAGING_STUDENT_EMAIL`                   | _(trống)_                             | Tài khoản sinh viên PTIT được kích hoạt cho parity staging                       |
| `STAGING_STUDENT_PASSWORD`                | _(trống)_                             | Secret sinh viên staging; không ghi vào Git                                      |
| `STAGING_LECTURER_EMAIL`                  | _(trống)_                             | Tài khoản giảng viên PTIT được kích hoạt cho parity staging                      |
| `STAGING_LECTURER_PASSWORD`               | _(trống)_                             | Secret giảng viên staging; không ghi vào Git                                     |
| `API_BASE_URL`                            | `http://127.0.0.1:3001`               | Origin backend dùng cho parity staging                                           |
| `PARITY_STUDENT_EMAIL/PASSWORD`           | _(trống)_                             | Credential sinh viên cho parity staging                                          |
| `PARITY_LECTURER_EMAIL/PASSWORD`          | _(trống)_                             | Credential giảng viên cho parity staging                                         |
| `PARITY_ALLOW_WRITES`                     | `false`                               | Cho phép write parity khi có đủ xác nhận disposable/host                         |
| `PARITY_CONFIRM_DISPOSABLE`               | `false`                               | Xác nhận database parity có thể phục hồi hoặc bỏ                                 |
| `PARITY_CONFIRM_HOST`                     | _(trống)_                             | Host parity phải khớp target                                                     |
| `LOAD_TEST_BASE_URL`                      | `http://127.0.0.1:3001`               | Origin backend dùng cho capacity probe                                           |
| `LOAD_TEST_EMAIL/PASSWORD`                | _(trống)_                             | Credential sinh viên riêng cho load test                                         |
| `LOAD_TEST_CREDENTIALS_PATH`              | _(trống)_                             | JSON secret chứa pool tài khoản; bắt buộc cho profile tải cao                    |
| `LOAD_TEST_ALLOW_HIGH`                    | `false`                               | Cho phép profile tải cao đã được duyệt                                           |
| `LOAD_TEST_CONFIRM_STAGING`               | `false`                               | Xác nhận target tải cao là staging disposable                                    |
| `LOAD_TEST_CONFIRM_HOST`                  | _(trống)_                             | Host load test phải khớp target                                                  |
| `LOAD_TEST_MAX_REQUESTS`                  | `20000`                               | Trần request dự kiến trước khi generator được phép chạy                          |
| `RESTORE_DATABASE_URL`                    | _(trống)_                             | URL của database restore drill riêng, không phải source staging                  |
| `RESTORE_DATABASE_SSL_MODE`               | `verify-full`                         | TLS mode riêng cho restore target                                                |
| `RESTORE_DATABASE_SSL_CA_PATH`            | _(trống)_                             | CA tin cậy của restore target                                                    |
| `RESTORE_CONFIRM_HOST/NAME/USER`          | _(trống)_                             | Ba xác nhận identity riêng cho restore target                                    |
| `RESTORE_CONFIRM_DISPOSABLE`              | `false`                               | Xác nhận restore target có thể xóa/bỏ                                            |
| `RESTORE_CONFIRM_CLEAN`                   | `false`                               | Xác nhận cho phép pg_restore clean schema trên target disposable                 |
| `NODE_ENV`                                | `development`                         | Môi trường chạy                                                                  |
| `VITE_DATA_SOURCE`                        | `api`                                 | Dùng `api` cho backend hoặc `mock` cho repository mô phỏng                       |
| `RAG_DEMO_DATA`                           | `true`                                | Đặt `false` để không seed dữ liệu RAG demo                                       |

## Build production cục bộ

```bash
npm run build
npm start
```

Backend phục vụ API và thư mục `dist` tại `http://127.0.0.1:3001`.

## Kiểm tra chất lượng

Chạy toàn bộ quy trình kiểm tra:

```bash
npm run check
```

Lệnh này chạy lần lượt Prettier, ESLint, Vitest và production build. Bộ kiểm thử bao phủ session,
RBAC, rate limit đăng nhập, các vertical slice chính, audit log, SQLite/PostgreSQL database
boundary, migration guard, chatbot demo và async repository.

Có thể chạy riêng từng bước:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

## Cấu trúc dự án

```text
server/                 HTTP API, session, SQLite/PostgreSQL adapters, migrations và repositories
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

- [Kế hoạch dự án](./PROJECT_PLAN.md)
- [API](./docs/API.md)
- [SQLite schema](./docs/DATABASE.md)
- [Frontend contracts](./docs/FRONTEND_CONTRACTS.md)
- [Chatbot/backend integration contract](./docs/CHATBOT_BACKEND_INTEGRATION.md)
- [Phase 0 executable contracts](./contracts/README.md)
- [Phase 4 backend foundation](./docs/PHASE_4_BACKEND_FOUNDATION.md)
- [DB-3 PostgreSQL migration](./docs/PHASE_DB3_POSTGRES_MIGRATION.md)
- [DB-4B async repositories và runtime](./docs/PHASE_DB4B_ASYNC_REPOSITORIES.md)
- [API parity staging check](./docs/API_PARITY.md)
- [API load test](./docs/LOAD_TEST.md)
- [DB-5.5 backup/restore drill](./docs/PHASE_DB5_BACKUP_RESTORE.md)
- [AUTH-1 xác minh mật khẩu bất đồng bộ](./docs/PHASE_AUTH1_ASYNC_PASSWORD.md)
- [AUTH-2 bảo vệ endpoint đăng nhập](./docs/PHASE_AUTH2_LOGIN_PROTECTION.md)
- [Contract tích hợp Outlook SSO PTIT](./docs/OUTLOOK_SSO_INTEGRATION.md)
- [Implementation history: Student → production readiness](./docs/IMPLEMENTATION_HISTORY.md)
- [Kế hoạch quản trị môn học và lớp tín chỉ](./docs/ADMIN_CLASS_MANAGEMENT_PLAN.md)
- [Nghiệm thu Plan A và Phase 9 hardening](./docs/PHASE_ADMIN9_HARDENING.md)
- [DB-5 PostgreSQL staging cutover](./docs/PHASE_DB5_POSTGRES_STAGING.md)
- [Design system](./design-system/ptit-teaching-assistant/MASTER.md)

## Nguồn hình ảnh

Hình ảnh được lưu cục bộ để bảo đảm bản demo ổn định. Thông tin nguồn và giấy phép được ghi tại:

- [Ảnh trình chiếu học phần](./src/assets/COURSE_SHOWCASE_ATTRIBUTION.md)
- [Ảnh bìa học phần](./src/assets/courses/ATTRIBUTION.md)
- [Ảnh minh họa dashboard](./src/assets/dashboard/ATTRIBUTION.md)

Các ảnh PTIT còn lại được sử dụng cho mục đích minh họa và sẽ tiếp tục được đội dự án kiểm duyệt trước khi phát hành chính thức.

## Repository

[github.com/24xNoVemBer/Chinh_tri_PTIT](https://github.com/24xNoVemBer/Chinh_tri_PTIT)
