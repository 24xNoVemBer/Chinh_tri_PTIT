# Practice Phase 1 — data và API

Phase này mở rộng nền tảng luyện tập để UI có thể hiển thị tiến độ theo lớp, luyện lại câu sai và chuẩn bị dữ liệu thống kê cho giảng viên.

## Đã triển khai

- SQLite schema và PostgreSQL migration `004_practice-analytics.sql` có thêm:
  - `practice_sessions.class_id`, `mode`, `source_session_id`.
  - `practice_session_questions.started_at`, `answer_duration_ms`.
  - index theo lớp, sinh viên/học phần và câu hỏi/độ chính xác.
- Phiên mới ghi nhận lớp ghi danh, chế độ `standard` hoặc `retry_wrong`, phiên nguồn và thời điểm bắt đầu từng câu.
- Khi sinh viên trả lời, API lưu thời lượng câu và tự mở bộ đếm cho câu tiếp theo.
- Config học phần trả về các lớp sinh viên đã ghi danh để UI cho phép chọn scope.
- Retry chỉ lấy các câu có `is_correct = 0` từ phiên nguồn của chính sinh viên.

## API sinh viên

```text
GET  /api/student/practice/overview
GET  /api/student/practice/stats?subjectId=&chapterId=
GET  /api/student/practice/config/:subjectId
POST /api/student/practice-sessions
```

Body tạo phiên hỗ trợ:

```json
{
  "subjectId": "sub1",
  "classId": "class1",
  "chapterId": "chap1",
  "questionCount": 10,
  "mode": "standard",
  "sourceSessionId": null
}
```

Để luyện lại câu sai, gửi `mode: "retry_wrong"` và `sourceSessionId`. API vẫn kiểm tra quyền ghi danh và quyền sở hữu phiên nguồn.

## API giảng viên

```text
GET /api/lecturer/practice-analytics?classId=&subjectId=
```

Response hiện có `summary`, `byChapter`, `questions` và `scope`. Các chỉ số đều trả kèm mẫu thực tế (`answeredCount`, `attempts`) để UI không diễn giải nhầm dữ liệu ít.

## Tương thích và vận hành

- SQLite local tự bổ sung cột/index khi khởi tạo, không cần xoá database demo.
- Migration PostgreSQL là additive và có thể chạy lặp qua migration runner.
- `ORDER BY RANDOM()` vẫn giữ cho MVP; cần thay bằng chiến lược sampling theo bucket khi tiến hành hardening cho 2–3 nghìn người dùng cao điểm.
- Pagination, cache ngắn hạn, biểu đồ UI và quyền export sẽ được hoàn thiện ở các phase tiếp theo.
