# SQLite schema — Phase 5 UI demo

Ứng dụng dùng `node:sqlite` có sẵn trong Node.js 24. Database mặc định:
`data/ptit-teaching-assistant.sqlite`.

## Nhóm bảng

- Người dùng và truy cập: `users`, `sessions`, `auth_login_limits`.
- Chương trình học: `subjects`, `chapters`, `lessons`.
- Lớp học: `course_classes`, `enrollments`, `enrollment_profiles`, `class_lessons`.
- Học liệu: `materials`, `material_versions`, `approved_sources`, `class_materials`.
- Hỏi đáp: `questions`, `lecturer_answers`, `mock_response_templates`, `mock_responses`.
- RAG demo và kiểm duyệt: `rag_requests`, `rag_responses`, `rag_citations`, `rag_reviews`.
- Học tập và tra cứu: `learning_progress`, `search_history`.
- Truy vết: `audit_logs`.
- Phiên bản schema: `schema_meta`.

Các bảng nghiệp vụ dùng foreign key, unique constraint và index theo các đường truy cập chính.
SQLite chạy WAL khi dùng file thật.

## Seed cục bộ

Database development được seed thêm hai câu trả lời RAG mô phỏng: một bản chờ duyệt và một bản đã
duyệt, đều có citation và `model_version = demo-ui-v1`. Không seed dữ liệu này khi
`NODE_ENV=production` hoặc `RAG_DEMO_DATA=false`.

| Vai trò    | Email                 | Mật khẩu       |
| ---------- | --------------------- | -------------- |
| Sinh viên  | `tuananh@ptit.edu.vn` | `Student@123`  |
| Giảng viên | `ductu@ptit.edu.vn`   | `Lecturer@123` |

Đây chỉ là tài khoản development; production phải thay bằng cơ chế cấp tài khoản hoặc SSO.

## Persistence và audit

- Tiến độ, trạng thái sinh viên, lịch bài, học liệu, câu hỏi, câu trả lời và lịch sử tìm kiếm được
  ghi trực tiếp vào SQLite.
- Request/response mô phỏng từ Chat API, citation và quyết định kiểm duyệt được lưu tách riêng để
  sinh viên và giảng viên dùng chung một luồng có đủ trạng thái truy vết.
- Audit log là append-only cho thao tác quản lý lớp, cập nhật tiến độ, tạo câu hỏi/chat, trả lời và
  kiểm duyệt RAG.
- Test đóng rồi mở lại cùng file database để xác nhận dữ liệu không mất.

## Migration

Schema SQLite hiện tại là version `3`. PostgreSQL bổ sung bảng rate limit qua migration
`002_auth-login-limits.sql`. Khi đổi schema:

1. Tăng `schema_version`.
2. Viết migration tiến về phía trước, không sửa dữ liệu seed đã tồn tại.
3. Kiểm thử với database mới và database version trước.
4. Sao lưu file SQLite trước khi triển khai migration production.
