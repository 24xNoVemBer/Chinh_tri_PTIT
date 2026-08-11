# Trạng thái triển khai tính năng luyện tập

## Phạm vi đã hoàn thành

- Sinh viên chọn học phần/lớp/chương và số câu để tạo phiên luyện tập.
- Mỗi câu chỉ hiển thị một lần; sau khi chọn đáp án, hệ thống khóa lựa chọn, trả kết quả đúng/sai và giải thích.
- Deep-link/reload khôi phục được phiên; câu đã trả lời vẫn hiển thị feedback.
- Kết quả có phần xem lại toàn bộ đáp án và nút luyện lại riêng các câu sai.
- Dashboard sinh viên hiển thị độ chính xác, số câu đã làm, phiên đang luyện và học phần cần củng cố.
- Giảng viên tạo/sửa/xuất bản/lưu trữ câu hỏi thủ công trong ngân hàng có lọc và phân trang.
- Trang phân tích giảng viên theo lớp có số sinh viên tham gia, phiên, độ chính xác, mức độ theo chương và câu hỏi sai nhiều.

## API chính

```text
GET  /api/student/practice/overview
GET  /api/student/practice/stats
GET  /api/student/practice/config/:subjectId
POST /api/student/practice-sessions
GET  /api/student/practice-sessions/:id
POST /api/student/practice-sessions/:id/answers
POST /api/student/practice-sessions/:id/complete
GET  /api/student/practice-sessions/history

GET  /api/lecturer/practice-questions?page=&pageSize=&status=&query=
GET  /api/lecturer/practice-analytics?classId=&subjectId=
```

## Dữ liệu và quyền

- Session ghi `class_id`, `mode`, `source_session_id` và thời lượng từng câu.
- `retry_wrong` chỉ lấy câu sai từ phiên thuộc chính sinh viên đó.
- Sinh viên chỉ xem phiên của mình và lớp đã ghi danh; giảng viên chỉ xem lớp mình phụ trách.
- SQLite local tự nâng schema; PostgreSQL dùng migration `004_practice-analytics.sql`.

## Hardening đã làm

- Lấy mẫu câu hỏi tiêu chuẩn dùng `COUNT + OFFSET` và `ORDER BY id`, tránh `ORDER BY RANDOM()` trên toàn bộ ngân hàng.
- Ngân hàng câu hỏi giới hạn page size 1–50 và trả metadata phân trang.
- Các chỉ số thống kê luôn trả số mẫu (`answered`, `attempts`, `answeredCount`) để UI tránh kết luận từ dữ liệu quá ít.
- UI giữ trạng thái loading/empty/error/retry, không dùng animation khi reduced-motion và không tạo horizontal overflow.

## Việc để sau khi tích hợp chatbot

- Kết nối RAG thật và gắn citation vào luồng hỏi đáp.
- Import Excel/Word, sinh câu hỏi bằng AI, đề thi có thời gian, leaderboard và đồng bộ điểm.
- Cache/rollup analytics, partition hoặc read replica khi tải thực tế 2–3 nghìn người dùng cao điểm.
- Chạy load test với dữ liệu production-like và đặt SLO p95 theo hạ tầng triển khai.
