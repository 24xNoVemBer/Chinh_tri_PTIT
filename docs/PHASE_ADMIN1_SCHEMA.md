# Phase ADMIN-1 — Schema quản trị và lớp tín chỉ

## Thay đổi

- SQLite schema version tăng lên `6`.
- PostgreSQL bổ sung migration `006_admin-class-management.sql`.
- Role hợp lệ gồm `student`, `lecturer`, `admin`.
- Bổ sung học kỳ, trạng thái tài khoản/môn/lớp và metadata lớp tín chỉ.
- Thay quan hệ một giảng viên bằng bảng nhiều-nhiều `class_lecturer_assignments`.
- Bổ sung phạm vi lớp cho hỏi đáp và bảng phân phối câu hỏi trắc nghiệm theo lớp.

## Chiến lược tương thích

`course_classes.lecturer_id` được giữ tạm thời. Dữ liệu cũ được backfill thành assignment `lead` và
repository sẽ được chuyển sang bảng assignment ở Phase ADMIN-2. Cột cũ chỉ được xóa sau khi kiểm
tra parity và rollback drill hoàn tất.

SQLite tự nâng constraint role cũ mà không xóa tài khoản. PostgreSQL migration chỉ tiến về phía
trước và giữ nguyên ID hiện tại để snapshot/import vẫn xác định được quan hệ.

## Kiểm chứng

- Database mới có thể seed đầy đủ.
- Database SQLite cũ chấp nhận role admin sau nâng cấp và không mất tài khoản.
- Một lớp nhận được nhiều giảng viên nhưng chỉ có tối đa một `lead` đang hoạt động.
- Hỏi đáp cũ được backfill `class_id` theo enrollment và môn.
- Snapshot migration bao gồm ba bảng mới theo đúng thứ tự khóa ngoại.
