# Phase ADMIN-2 — RBAC theo lớp tín chỉ

## Kết quả

- Session chỉ hợp lệ khi tài khoản còn `active` và `auth_version` của session trùng tài khoản.
- `/api/auth/me` chấp nhận ba role `student`, `lecturer`, `admin`.
- `RoleGuard` hỗ trợ một hoặc nhiều role để tái sử dụng cho màn quản trị.
- Quyền lớp, hỏi đáp, thống kê, học liệu và ngân hàng câu hỏi được xác định từ
  `class_lecturer_assignments` đang hoạt động.
- Câu hỏi thường, chat demo và live RAG đều ghi snapshot `class_id` khi tạo.
- Khi sinh viên có nhiều lớp trong cùng môn, API yêu cầu chỉ rõ `classId`.
- Câu hỏi không có lớp hoặc lớp không có giảng viên được đánh dấu `unrouted`.

## Bảo đảm

- Một giảng viên phối hợp có quyền lớp giống giảng viên đầu mối.
- Assignment `inactive` bị từ chối ngay ở backend.
- Thay role hoặc trạng thái tài khoản có thể tăng `auth_version` để thu hồi toàn bộ phiên cũ.
- Repository không còn dùng `course_classes.lecturer_id` để quyết định authorization.
