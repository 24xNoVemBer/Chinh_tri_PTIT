# Phase 6 — Hàng đợi hỏi đáp đa giảng viên

## Kết quả

Mỗi lớp tín chỉ có một hàng đợi hỏi đáp chung cho tất cả giảng viên đang được phân công. Câu hỏi
được giữ ở trạng thái `queued` cho đến khi một giảng viên nhận xử lý; cập nhật có điều kiện tại
database bảo đảm hai request đồng thời không thể cùng claim một câu.

Các trạng thái điều phối là `unrouted`, `queued`, `claimed`, `answered` và `closed`. Trạng thái nội
dung `unanswered/answered` vẫn được giữ để tương thích với lịch sử hỏi đáp hiện có.

## Quy tắc sở hữu

- Chỉ giảng viên có assignment `active` của lớp được xem hàng đợi.
- Người đã claim có thể trả lời, kiểm duyệt RAG hoặc release câu hỏi.
- Giảng viên khác chỉ được xem, không thể ghi đè câu trả lời hoặc bản kiểm duyệt.
- Trả lời một câu chưa có người nhận sẽ tự claim trong backend để giữ tương thích API.
- Admin chỉ có thể reassign cho giảng viên đang hoạt động trong đúng lớp.
- Khi kết thúc phân công, các claim của giảng viên đó được trả về hàng đợi theo transaction quản trị.

## SLA và giao diện

SLA mặc định là 24 giờ tính từ lúc sinh viên gửi câu hỏi. API trả `on_track`, `due_soon`, `overdue`
hoặc `resolved`. Chỉ giảng viên `lead` nhận cờ `leadAlert`; các giảng viên phối hợp vẫn thấy nhãn SLA
trên từng câu.

Trang lớp cho phép nhận/trả câu trực tiếp. Trang chi tiết chỉ mở biểu mẫu trả lời và kiểm duyệt khi
người dùng đang sở hữu claim. Trang vận hành Admin hiển thị cả câu chưa định tuyến và câu đã định
tuyến để chuyển người xử lý.

## Kiểm thử trọng yếu

- Hai giảng viên claim đồng thời: đúng một request thành công, request còn lại nhận `409`.
- Giảng viên thua claim không thể release hoặc trả lời.
- Giảng viên ngoài lớp nhận `403` khi đọc hàng đợi.
- Admin không thể reassign cho giảng viên ngoài lớp.
- Lead nhận cảnh báo SLA quá hạn; giảng viên phối hợp không nhận cảnh báo cấp lớp.
- Trả lời thành công cập nhật đồng thời `status`, `routing_status`, `claimed_by` và `row_version`.
