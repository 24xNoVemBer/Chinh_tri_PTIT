# Phase 7 — Thống kê riêng theo lớp tín chỉ

## Phạm vi dữ liệu

Dashboard thống kê sử dụng `class_id` làm ranh giới bắt buộc. Giảng viên chỉ truy cập lớp có
assignment `active`; quản trị viên có thể chọn mọi lớp đang hoạt động. Hai lớp cùng một môn vẫn có
các tập enrollment, phiên luyện tập, hỏi đáp và hoạt động giảng viên độc lập.

## Chỉ số

### Học tập

- Tổng sĩ số lấy từ enrollment, không suy ra từ phiên luyện tập.
- Số sinh viên đã tham gia và tỷ lệ tham gia.
- Tổng phiên, số phiên luyện tập, số phiên thi thử và số phiên hoàn thành.
- Độ chính xác trên toàn bộ lượt trả lời và điểm trung bình của phiên hoàn thành.
- Mức độ ôn tập theo chương và danh sách câu hỏi có tỷ lệ sai cao.
- Danh sách sinh viên `not_started`, `needs_support` hoặc `on_track`.

Sinh viên được đánh dấu `needs_support` khi độ chính xác dưới 60% hoặc hồ sơ enrollment đang ở
trạng thái `attention`. Sinh viên chưa có phiên nào được đánh dấu `not_started`.

### Hỏi đáp và giảng viên

- Tổng câu hỏi, đang chờ, đã trả lời, quá SLA 24 giờ và thời gian phản hồi trung bình.
- Với từng giảng viên: vai trò phân công, số claim đang mở, số câu đã trả lời và thời gian phản hồi
  trung bình.

## API và giao diện

- `GET /api/lecturer/classes/:classId/analytics`
- `GET /api/lecturer/practice-analytics?classId=...` được giữ để tương thích.
- `GET /api/admin/classes/:classId/analytics`
- Giảng viên mở thống kê trong từng lớp hoặc từ mục thống kê chung.
- Admin có mục `Thống kê` riêng và chọn lớp từ toàn hệ thống.

## Kiểm thử trọng yếu

- Lớp có ba enrollment nhưng một người luyện tập trả đúng: sĩ số `3`, tham gia `1`, tỷ lệ `33%`,
  độ chính xác `100%`.
- Phiên của lớp khác trong cùng môn không xuất hiện trong kết quả.
- Giảng viên ngoài assignment nhận `403`.
- Admin đọc được thống kê của mọi lớp và lớp không tồn tại trả `404`.
