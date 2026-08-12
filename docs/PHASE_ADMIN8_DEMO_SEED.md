# Phase 8 — Bộ dữ liệu demo quy mô lớn

## Kết quả

Module `server/db/demoSeed.js` cung cấp bộ seed dùng chung cho SQLite và PostgreSQL. Script
`npm run db:seed:demo -- --confirm-demo-seed` nạp dữ liệu bằng các ID ổn định và `ON CONFLICT`, nên
chạy lại không tạo bản ghi trùng.

Bộ dữ liệu gồm 2 Admin, 10 Giảng viên, 40 Sinh viên, 10 lớp, phân công nhiều giảng viên, 200
enrollment, câu hỏi dùng chung và riêng, phiên luyện tập/thi thử, hỏi đáp ở các trạng thái queued,
claimed và answered. Các lớp được chia đều trên năm môn để dashboard có dữ liệu so sánh thực tế.

Danh sách đăng nhập đầy đủ nằm tại [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md).

## Chốt an toàn

- Bắt buộc truyền `--confirm-demo-seed`.
- Từ chối vô điều kiện khi `NODE_ENV=production`.
- PostgreSQL yêu cầu xác nhận chính xác host, database và user trước khi kết nối.
- Không xóa dữ liệu không thuộc namespace demo.
- Mật khẩu của bản ghi đã tồn tại không bị seed ghi đè.

## Kiểm thử

- Chạy seed hai lần trên cùng database cho kết quả đếm giống hệt nhau.
- Xác minh đủ số lượng từng role và từng nhóm dữ liệu.
- Xác minh mỗi lớp có hai assignment.
- Xác minh production guard chạy trước mọi mutation.
- Đã chạy seed hai lần thành công trên file SQLite development hiện tại.
