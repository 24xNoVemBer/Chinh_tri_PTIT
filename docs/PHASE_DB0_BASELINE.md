# DB-0 — Baseline và quyết định thay thế SQLite

**Ngày:** 2026-08-04  
**Trạng thái:** Hoàn tất baseline, chưa thay đổi runtime  
**Phạm vi:** chuẩn hóa yêu cầu và đo hiện trạng trước khi chuyển database production

## 1. Quyết định phạm vi

- Database production mục tiêu: **PostgreSQL**.
- SQLite tiếp tục được giữ cho demo/local và test nhanh trong giai đoạn chuyển đổi.
- DB-0 không thay đổi schema runtime, API response, dữ liệu seed hoặc luồng đăng nhập.
- Bước kế tiếp là DB-1: tách database client/transaction khỏi repository; chưa cutover production.

Lý do chọn PostgreSQL: hệ thống cần phục vụ khoảng 1.000 phiên đồng thời và có thể tăng lên 2.000–3.000 phiên vào giai đoạn cao điểm. Thiết kế production tương ứng đã được ghi trong [CHATBOT_BACKEND_INTEGRATION.md](./CHATBOT_BACKEND_INTEGRATION.md).

## 2. Hiện trạng đã chụp

| Hạng mục       | Baseline hiện tại                          |
| -------------- | ------------------------------------------ |
| Runtime        | Node.js 24, `node:sqlite` / `DatabaseSync` |
| Database local | `data/ptit-teaching-assistant.sqlite`      |
| Database test  | SQLite `:memory:`                          |
| Seed demo      | Bật mặc định khi tạo database              |
| Journal        | WAL khi dùng file thật                     |
| Schema version | `2` trong `schema_meta`                    |
| Bảng           | 25                                         |
| Dữ liệu seed   | 121 bản ghi                                |
| API contract   | Giữ nguyên trong toàn bộ migration         |
| Test baseline  | 9 test files, 49 tests passing             |

## 3. Kiểm kê schema seed

Bảng dưới đây là snapshot từ database `:memory:` với seed mặc định. Số lượng là dữ liệu demo, không phải capacity production.

| Bảng                      | Rows | Vai trò                       |
| ------------------------- | ---: | ----------------------------- |
| `approved_sources`        |    4 | nguồn được phép dùng cho RAG  |
| `audit_logs`              |    0 | nhật ký thao tác              |
| `chapters`                |   15 | chương theo học phần          |
| `class_lessons`           |    5 | lịch bài học theo lớp         |
| `class_materials`         |    2 | học liệu gắn với lớp          |
| `course_classes`          |    2 | lớp học phần                  |
| `enrollment_profiles`     |    6 | tiến độ/trạng thái enrollment |
| `enrollments`             |    6 | sinh viên trong lớp           |
| `learning_progress`       |    5 | tiến độ bài học               |
| `lecturer_answers`        |    2 | câu trả lời của giảng viên    |
| `lessons`                 |   30 | nội dung bài học              |
| `material_versions`       |    6 | phiên bản học liệu            |
| `materials`               |    6 | học liệu                      |
| `mock_response_templates` |    5 | template phản hồi demo        |
| `mock_responses`          |    1 | phản hồi demo cũ              |
| `questions`               |    5 | câu hỏi sinh viên             |
| `rag_citations`           |    2 | trích dẫn nguồn RAG           |
| `rag_requests`            |    2 | yêu cầu gọi RAG               |
| `rag_responses`           |    2 | phản hồi RAG                  |
| `rag_reviews`             |    0 | duyệt phản hồi RAG            |
| `schema_meta`             |    1 | phiên bản schema              |
| `search_history`          |    2 | lịch sử tra cứu               |
| `sessions`                |    0 | session đăng nhập             |
| `subjects`                |    5 | học phần                      |
| `users`                   |    7 | tài khoản demo                |

### Index hiện có

- `idx_audit_actor` — `audit_logs(actor_id, created_at DESC)`
- `idx_classes_lecturer` — `course_classes(lecturer_id)`
- `idx_enrollments_student` — `enrollments(student_id)`
- `idx_questions_student` — `questions(student_id, created_at DESC)`
- `idx_questions_subject` — `questions(subject_id, status)`
- `idx_rag_citations_response` — `rag_citations(response_id, citation_order)`
- `idx_rag_requests_question` — `rag_requests(question_id, created_at DESC)`
- `idx_rag_responses_review` — `rag_responses(review_status, created_at DESC)`
- `idx_rag_reviews_response` — `rag_reviews(response_id, created_at DESC)`
- `idx_search_history_student` — `search_history(student_id, created_at DESC)`
- `idx_sessions_token` — `sessions(token_hash)`

## 4. Điểm phụ thuộc SQLite cần xử lý ở DB-1/DB-2

| Khu vực                        | Phụ thuộc                                  | Cách xử lý dự kiến                                     |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| `server/database.js`           | schema, seed, `DatabaseSync`, WAL          | chuyển schema/seed thành migrations và adapter         |
| `server/repositories.js`       | `prepare().get/all/run`, `BEGIN IMMEDIATE` | gọi qua database client + transaction helper           |
| `server/auth.js`               | truy vấn user/session, session cleanup     | dùng repository/client, giữ nguyên cookie contract     |
| `server/rag/liveRepository.js` | transaction ghi request/response/citation  | giữ transaction ngắn, idempotency và unique constraint |
| `server/index.js`              | khởi tạo một SQLite connection             | khởi tạo PostgreSQL pool theo runtime config           |
| `server/*.test.js`             | database `:memory:`                        | chạy contract test trên adapter test và PostgreSQL     |

## 5. API surface cần giữ nguyên

- Health/readiness: `GET /api/health`, `GET /api/ready`.
- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Student: dashboard, subjects, lessons/progress, questions, chat, search và search history.
- Lecturer: classes, students/metrics, lessons/materials, questions/answers, RAG review và audit logs.

Database migration không được đổi status code, error code, JSON shape hoặc RBAC của các route trên.

## 6. Tiêu chí nghiệm thu DB-0

- [x] Có snapshot schema/table/index và số lượng seed.
- [x] Có danh sách điểm gọi SQLite trực tiếp.
- [x] Có target database và phạm vi không thay đổi.
- [x] Có lệnh tạo lại baseline: `npm run db:baseline`.
- [x] Baseline test hiện tại: 49/49 pass.
- [x] Không tạo migration hoặc thay đổi runtime trong DB-0.

## 7. Lệnh tái lập baseline

```bash
npm run db:baseline
```

Mặc định lệnh dùng database `:memory:` và seed demo, sau đó in JSON ra stdout. Có thể kiểm tra file SQLite cụ thể mà không seed thêm:

```bash
DATABASE_PATH=data/ptit-teaching-assistant.sqlite DB_BASELINE_SEED=false npm run db:baseline
```
