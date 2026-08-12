# Phase Admin 4 — Giao diện quản trị

## Định hướng

Giao diện tuân theo `design-system/ptit-teaching-assistant/MASTER.md` và bộ quy tắc `ui-ux-pro-max`:

- Thanh điều hướng ngang, cùng cấu trúc với không gian sinh viên/giảng viên.
- Nền sáng, surface trắng, đỏ PTIT chỉ dùng cho active state và hành động chính.
- Bảng có header, `scope`, nhãn form hiển thị và target tương tác tối thiểu 44 px.
- Responsive tại 375, 768, 1024 và 1440 px; bảng cuộn trong panel thay vì làm tràn trang.
- Motion chỉ dùng khi chuyển trang, tự tắt theo `prefers-reduced-motion`.

## Các không gian đã xây

| Route                  | Chức năng                                           |
| ---------------------- | --------------------------------------------------- |
| `/admin`               | Chỉ số toàn hệ thống, học kỳ và nguồn lực giảng dạy |
| `/admin/users`         | Tìm, lọc, gán vai trò và khóa/mở tài khoản          |
| `/admin/subjects`      | Môn, chương, bài học và học liệu dùng chung         |
| `/admin/terms`         | Vòng đời học kỳ                                     |
| `/admin/classes`       | Lớp tín chỉ và phân công nhiều giảng viên           |
| `/admin/question-bank` | Ngân hàng trắc nghiệm dùng chung theo môn           |
| `/admin/operations`    | Điều phối câu hỏi chưa xác định lớp và audit log    |

## Quyền truy cập

Toàn bộ route nằm sau `RoleGuard role="admin"`. API tiếp tục là lớp bảo vệ có thẩm quyền; ẩn menu không được xem là biện pháp bảo mật.
