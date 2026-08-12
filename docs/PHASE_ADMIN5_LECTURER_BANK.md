# Phase 5 — Ngân hàng câu hỏi riêng theo lớp tín chỉ

## Kết quả

Phase này tách rõ hai nguồn câu hỏi luyện tập:

- `subject_shared`: câu hỏi dùng chung toàn môn do quản trị viên quản lý. Giảng viên phụ trách môn chỉ được xem; sinh viên thuộc mọi lớp tín chỉ của môn có thể luyện tập khi câu hỏi đã xuất bản.
- `lecturer_owned`: câu hỏi riêng do giảng viên tạo. Chỉ người tạo được sửa, xuất bản, lưu trữ hoặc xóa; câu hỏi phải được gán vào ít nhất một lớp tín chỉ mà người đó đang được phân công.

Một lớp tín chỉ có thể có nhiều giảng viên. Quyền truy cập lớp và quyền gán câu hỏi được xác định qua `class_lecturer_assignments`, không dựa vào một cột giảng viên duy nhất. Một lớp chỉ được có tối đa một phân công `lead`, nhưng có thể có nhiều phân công `lecturer` đang hoạt động.

## Quy tắc hiển thị

Sinh viên tạo phiên luyện tập trong một lớp chỉ nhận:

1. câu hỏi `subject_shared` đã xuất bản của môn;
2. câu hỏi `lecturer_owned` đã xuất bản và có assignment `published` tới đúng lớp đó.

Câu hỏi riêng của lớp khác hoặc của giảng viên khác không được đưa vào tập lấy mẫu. Câu hỏi dùng chung không hiện thao tác sửa/xóa trong giao diện giảng viên.

## API và payload

- `GET /api/lecturer/practice-questions`: ngân hàng cá nhân của giảng viên cộng câu hỏi dùng chung đã xuất bản thuộc các môn đang dạy.
- `GET /api/lecturer/classes/:classId/practice-questions`: câu hỏi dùng chung và câu hỏi riêng của giảng viên áp dụng cho một lớp.
- `POST /api/lecturer/practice-questions`, `PATCH /api/lecturer/practice-questions/:id` và `POST /api/lecturer/practice-questions/import` bắt buộc có `classIds: string[]`.
- `POST /api/lecturer/practice-questions/:id/publish` từ chối câu hỏi chưa có lớp áp dụng.

`classAssignments` và `canEdit` được trả về cùng câu hỏi để client hiển thị đúng phạm vi và không dựng thao tác vượt quyền.

## Giao diện giảng viên

Điều hướng trong một lớp gồm:

`Tổng quan | Sinh viên | Câu hỏi ôn tập | Hỏi đáp | Thống kê | Nội dung môn`

- Trình tạo thủ công và nhập CSV cho phép chọn nhiều lớp cùng môn.
- Khi mở từ một lớp cụ thể, lớp đó được chọn sẵn và sau khi lưu người dùng quay lại đúng lớp.
- Trang `Nội dung môn` hợp nhất chương trình và học liệu thành chế độ chỉ đọc. URL quản lý bài học/học liệu cũ chuyển hướng về trang này.

## Kiểm thử trọng yếu

- Giảng viên thứ hai cùng lớp thấy câu hỏi dùng chung ở chế độ chỉ đọc nhưng không thấy ngân hàng riêng của giảng viên khác.
- Endpoint lớp kiểm tra phân công hiện hành.
- Sinh viên lớp khác không nhận câu hỏi riêng không được gán cho lớp mình.
- Tạo, nhập CSV, cập nhật và xuất bản đều kiểm tra `classIds` ở backend.

## Ngoài phạm vi phase

- Claim/release/reassign hàng đợi hỏi đáp: Phase 6.
- Hoàn thiện dashboard thống kê riêng từng lớp: Phase 7.
- Bộ seed demo lớn và tài khoản demo: Phase 8.
