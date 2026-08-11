# API web — Phase 4

API dùng JSON, cùng origin với frontend và trả dữ liệu theo dạng:

```json
{ "data": {} }
```

Lỗi có dạng:

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Mô tả lỗi có thể hiển thị cho người dùng.",
    "retryable": false
  }
}
```

## Xác thực

| Method | Endpoint           | Mô tả                                                        |
| ------ | ------------------ | ------------------------------------------------------------ |
| `POST` | `/api/auth/login`  | Đăng nhập bằng `email`, `password`; `role` là guard tùy chọn |
| `GET`  | `/api/auth/me`     | Lấy người dùng của session hiện tại                          |
| `POST` | `/api/auth/logout` | Hủy session                                                  |

Session token là chuỗi ngẫu nhiên, chỉ bản băm SHA-256 được lưu trong database runtime đã cấu hình. Cookie
`ptit_session` có `HttpOnly`, `SameSite=Lax`, `Path=/`; production bổ sung `Secure`.
Mật khẩu seed được băm bằng `scrypt`.

`POST /api/auth/login` dùng giới hạn theo tài khoản và cặp nguồn–tài khoản. Khi vượt
ngân sách, API trả `429`, code `AUTH_RATE_LIMITED`, `retryable: true` cùng các header
`Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` và
`RateLimit-Policy`. Email và IP chỉ được lưu dưới dạng scope SHA-256 trong bảng runtime;
đăng nhập hợp lệ xóa ngân sách tương ứng.

## Giảng viên

Tất cả endpoint dưới đây yêu cầu role `lecturer`.

| Method     | Endpoint                                             | Mô tả                                |
| ---------- | ---------------------------------------------------- | ------------------------------------ |
| `GET`      | `/api/lecturer/classes`                              | Danh sách lớp đang phụ trách         |
| `GET`      | `/api/lecturer/classes/:classId`                     | Chi tiết lớp                         |
| `GET`      | `/api/lecturer/classes/:classId/students`            | Danh sách, tìm kiếm, lọc sinh viên   |
| `PATCH`    | `/api/lecturer/classes/:classId/students/:studentId` | Cập nhật trạng thái sinh viên        |
| `GET`      | `/api/lecturer/classes/:classId/metrics`             | Chỉ số lớp                           |
| `GET/POST` | `/api/lecturer/classes/:classId/lessons`             | Danh sách hoặc xếp lịch bài học      |
| `GET`      | `/api/lecturer/classes/:classId/lessons/available`   | Bài học có thể thêm                  |
| `PATCH`    | `/api/lecturer/classes/:classId/lessons/:id`         | Đổi trạng thái bài học               |
| `GET/POST` | `/api/lecturer/classes/:classId/materials`           | Danh sách hoặc gắn học liệu          |
| `GET`      | `/api/lecturer/classes/:classId/materials/available` | Học liệu đã duyệt có thể thêm        |
| `PATCH`    | `/api/lecturer/classes/:classId/materials/:id`       | Đổi trạng thái học liệu              |
| `POST`     | `/api/lecturer/materials/:materialId/versions`       | Thêm metadata phiên bản học liệu     |
| `GET`      | `/api/lecturer/questions`                            | Danh sách câu hỏi, hỗ trợ filter     |
| `GET`      | `/api/lecturer/questions/:id`                        | Chi tiết câu hỏi thuộc lớp phụ trách |
| `POST`     | `/api/lecturer/questions/:id/answer`                 | Tạo hoặc cập nhật câu trả lời        |
| `GET`      | `/api/lecturer/audit-logs`                           | Nhật ký hoạt động liên quan          |

### Ngân hàng câu hỏi luyện tập

| Method | Endpoint | Mô tả |
| ------ | -------- | ---- |
| `GET` | `/api/lecturer/practice-questions` | Danh sách câu hỏi theo học phần/chương/trạng thái |
| `POST` | `/api/lecturer/practice-questions` | Tạo câu hỏi thủ công ở trạng thái nháp |
| `GET` | `/api/lecturer/practice-questions/:id` | Xem chi tiết câu hỏi |
| `PATCH` | `/api/lecturer/practice-questions/:id` | Cập nhật nội dung và lựa chọn |
| `POST` | `/api/lecturer/practice-questions/:id/publish` | Xuất bản câu hỏi |
| `POST` | `/api/lecturer/practice-questions/:id/archive` | Lưu trữ câu hỏi |

## Sinh viên

Tất cả endpoint dưới đây yêu cầu role `student`; `studentId` luôn lấy từ session.

| Method     | Endpoint                            | Mô tả                                 |
| ---------- | ----------------------------------- | ------------------------------------- |
| `GET`      | `/api/student/dashboard`            | Tổng quan học tập                     |
| `GET`      | `/api/student/subjects`             | Môn đã ghi danh và tiến độ            |
| `GET`      | `/api/student/subjects/:id`         | Tổng quan môn, chương và bài          |
| `GET`      | `/api/student/chapters/:id/lessons` | Bài học trong chương                  |
| `GET`      | `/api/student/lessons/:id`          | Nội dung bài học có kiểm tra ghi danh |
| `PATCH`    | `/api/student/lessons/:id/progress` | Lưu tiến độ 0–100                     |
| `GET/POST` | `/api/student/questions`            | Lịch sử hoặc tạo câu hỏi              |
| `GET`      | `/api/student/questions/:id`        | Chi tiết câu hỏi của chính sinh viên  |
| `POST`     | `/api/student/chat`                 | Tạo câu trả lời demo và citation      |
| `POST`     | `/api/student/search`               | Tra cứu trong phạm vi môn đã ghi danh |
| `GET`      | `/api/student/search-history`       | Lịch sử tra cứu                       |

### Luyện tập trắc nghiệm

| Method | Endpoint | Mô tả |
| ------ | -------- | ---- |
| `GET` | `/api/student/practice/config/:subjectId` | Phạm vi chương và số câu đã xuất bản |
| `POST` | `/api/student/practice-sessions` | Tạo phiên luyện tập |
| `GET` | `/api/student/practice-sessions/:id` | Khôi phục phiên và tiến độ |
| `POST` | `/api/student/practice-sessions/:id/answers` | Chấm một lựa chọn và trả giải thích |
| `POST` | `/api/student/practice-sessions/:id/complete` | Hoàn thành phiên |
| `GET` | `/api/student/practice-sessions/history` | Lịch sử phiên gần đây |

## RAG UI demo

Chat API chưa gọi model hoặc retrieval thật. `POST /api/student/chat` kiểm tra môn đã ghi danh, tạo
question, RAG request/response và citation trong một transaction, rồi trả ngay response có
`reviewStatus = pending_review` và `isDemo = true`. Frontend gắn nhãn phù hợp với kết quả phân
loại; cùng response xuất hiện trong review queue.

Response có thêm `moderation`:

```json
{
  "priority": "high | medium | sample",
  "queue": "attention | sample",
  "requiresReview": true,
  "reason": "Lý do phân loại có thể hiển thị cho giảng viên."
}
```

Quy tắc demo không dùng confidence giả: sai phạm vi môn hoặc citation thiếu trang được xếp
`high`; câu hỏi mở là `medium`; câu khớp chủ đề và có citation theo trang là `sample`.

| Method | Endpoint                                            | Mục đích                               |
| ------ | --------------------------------------------------- | -------------------------------------- |
| `POST` | `/api/student/chat`                                 | Tạo response demo và phân loại ưu tiên |
| `GET`  | `/api/lecturer/rag/reviews?status=...&priority=...` | Danh sách theo trạng thái và ưu tiên   |
| `POST` | `/api/lecturer/rag/responses/:id/review`            | Duyệt, loại hoặc yêu cầu chỉnh sửa     |

Body review gồm `action: approve | reject | needs_revision`, `content?` và `note?`. Model thật sẽ
được gắn sau qua cùng contract, không nằm trong checkpoint này.
