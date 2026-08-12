# Phase Admin 3 — API quản trị

Phase này hiện thực hóa ma trận quyền trong `ADMIN_CLASS_MANAGEMENT_PLAN.md` thành API và quy tắc nghiệp vụ có kiểm thử.

## Phạm vi đã hoàn thành

- Quản lý tài khoản: liệt kê, lọc, đổi vai trò, khóa/mở tài khoản.
- Thu hồi toàn bộ phiên sau khi đổi vai trò hoặc trạng thái; không cho hạ quyền quản trị viên hoạt động cuối cùng.
- CRUD môn học, học kỳ, lớp tín chỉ; thao tác xóa môn/lớp dùng cơ chế lưu trữ.
- Phân công nhiều giảng viên cho một lớp, tối đa một giảng viên phụ trách chính đang hoạt động.
- Khi kết thúc phân công, câu hỏi chưa trả lời do giảng viên đó nhận được tự động trả về hàng đợi.
- Admin CRUD chương, bài học, học liệu và phiên bản học liệu dùng chung.
- Admin CRUD ngân hàng câu hỏi trắc nghiệm dùng chung theo môn.
- Danh sách câu hỏi chưa điều phối và API gán lại vào lớp phù hợp.
- Nhật ký quản trị cho mọi thay đổi trên.
- Các endpoint ghi nội dung/học liệu cũ của giảng viên trả `403 ADMIN_ONLY_CURRICULUM`; giảng viên chỉ có quyền đọc.

## API

Hợp đồng chuẩn nằm tại `contracts/openapi/admin-management-api.v1.yaml`. Tất cả endpoint `/api/admin/*` yêu cầu cookie phiên của tài khoản `admin` đang hoạt động.

## Bằng chứng kiểm thử

`server/admin.test.js` bao phủ:

1. Chặn giảng viên truy cập API admin.
2. Bảo vệ admin hoạt động cuối cùng.
3. Thu hồi phiên khi đổi vai trò.
4. Phân công nhiều giảng viên và nhả claim khi kết thúc phân công.
5. Tạo nội dung dùng chung và câu hỏi trắc nghiệm dùng chung.

Tại thời điểm hoàn thành phase: 33 tệp test, 179 ca kiểm thử đều đạt.
