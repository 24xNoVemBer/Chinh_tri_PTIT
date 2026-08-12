# Kế hoạch quản trị môn học và lớp tín chỉ

**Trạng thái:** Plan A đã hoàn thành ở mức code ngày 12/08/2026. Báo cáo nghiệm thu và các cổng
staging còn lại nằm tại [PHASE_ADMIN9_HARDENING.md](./PHASE_ADMIN9_HARDENING.md).

## Mục tiêu

Mở rộng PTIT Chính Trị từ mô hình một giảng viên trên mỗi lớp thành mô hình quản trị theo phạm vi:

- `admin` quản trị tài khoản, môn học, học kỳ, lớp tín chỉ và nội dung dùng chung;
- một lớp tín chỉ có một hoặc nhiều giảng viên;
- một giảng viên có thể phụ trách nhiều lớp tín chỉ;
- giảng viên chỉ tạo và quản lý câu hỏi trắc nghiệm của mình trong các lớp được phân công;
- hỏi đáp được chuyển vào hàng đợi chung của lớp, sau đó một giảng viên nhận xử lý;
- thống kê luyện tập và hỏi đáp được tách riêng theo lớp tín chỉ.

## Mô hình phạm vi

```text
Môn học
├── Chương, bài học và học liệu (admin quản lý)
├── Ngân hàng câu hỏi dùng chung (admin quản lý)
└── Lớp tín chỉ / Tổ 01, 02, ...
    ├── Một giảng viên đầu mối và các giảng viên phối hợp
    ├── Sinh viên đăng ký
    ├── Câu hỏi ôn tập được phân phối cho lớp
    ├── Hàng đợi hỏi đáp chung
    └── Thống kê riêng
```

`Tổ` là tên hiển thị của lớp tín chỉ, không phải một thực thể dữ liệu độc lập.

## Ma trận quyền

| Năng lực                                | Admin         | Giảng viên được phân công   | Sinh viên                   |
| --------------------------------------- | ------------- | --------------------------- | --------------------------- |
| Gán hoặc thu hồi role                   | Toàn hệ thống | Không                       | Không                       |
| Tạo, sửa, lưu trữ môn và học kỳ         | Có            | Không                       | Không                       |
| Tạo lớp tín chỉ và phân công giảng viên | Có            | Không                       | Không                       |
| Tạo, sửa chương, bài học và học liệu    | Có            | Chỉ đọc                     | Chỉ đọc nội dung đã công bố |
| Tạo câu hỏi dùng chung toàn môn         | Có            | Không                       | Không                       |
| Tạo câu hỏi riêng                       | Có            | Có                          | Không                       |
| Sửa câu hỏi riêng                       | Mọi câu       | Chỉ câu do mình tạo         | Không                       |
| Phân phối câu hỏi cho lớp               | Mọi lớp       | Chỉ lớp đang được phân công | Không                       |
| Xem thống kê                            | Mọi lớp       | Chỉ lớp đang được phân công | Chỉ dữ liệu cá nhân         |
| Nhận và trả lời hỏi đáp                 | Mọi lớp       | Chỉ lớp đang được phân công | Tạo và xem câu của mình     |
| Xem nhật ký                             | Toàn hệ thống | Thao tác của mình           | Không                       |

Mọi quyền phải được kiểm tra ở backend. Việc ẩn nút ở frontend chỉ là hỗ trợ trải nghiệm.

## Vòng đời dữ liệu

### Phân công giảng viên

1. Admin chọn tài khoản đã tồn tại và có role `lecturer`.
2. Admin gán tài khoản vào lớp với vai trò `lead` hoặc `lecturer`.
3. Mỗi lớp có tối đa một `lead`, không giới hạn số giảng viên phối hợp.
4. Khi phân công kết thúc, bản ghi chuyển `inactive`; lịch sử không bị xóa.
5. Câu hỏi hỏi đáp đang được người bị gỡ nhận xử lý phải quay lại hàng đợi chung.

### Câu hỏi trắc nghiệm

- `subject_shared`: admin sở hữu, dùng chung toàn môn, giảng viên không sửa bản gốc.
- `lecturer_owned`: giảng viên sở hữu và chỉ phân phối cho lớp mình đang phụ trách.
- Một câu hỏi có thể được phân phối cho nhiều lớp.
- Xóa trên giao diện là lưu trữ mềm nếu câu hỏi đã xuất hiện trong phiên luyện tập.

### Hỏi đáp

1. Backend xác định lớp từ enrollment đang hoạt động của sinh viên và môn được hỏi.
2. Câu hỏi được tạo với `routing_status=queued` và chưa có người xử lý.
3. Một giảng viên của lớp nhận câu bằng cập nhật có điều kiện trong transaction.
4. Sau khi nhận, chỉ người nhận hoặc admin được trả lời, trả lại hàng đợi hay chuyển người xử lý.
5. Nếu không xác định được lớp hoặc lớp không có giảng viên, câu chuyển `unrouted` cho admin.
6. `class_id` được giữ như snapshot để thay đổi enrollment sau này không làm sai lịch sử.

## Chuyển đổi dữ liệu hiện tại

1. Tạo `class_lecturer_assignments` và backfill mọi `course_classes.lecturer_id` thành assignment `lead`.
2. Trong giai đoạn chuyển tiếp, đọc từ assignment trước và fallback cột cũ để kiểm tra parity.
3. Chuyển toàn bộ kiểm tra quyền, danh sách lớp, hỏi đáp và thống kê sang bảng assignment.
4. Chỉ xóa `course_classes.lecturer_id` sau khi test parity, backfill và rollback drill đạt yêu cầu.
5. Dữ liệu hỏi đáp cũ không xác định được lớp được đánh dấu legacy/unrouted để admin xử lý.

## API chuẩn

Contract quản trị được version hóa tại
[`contracts/openapi/admin-management-api.v1.yaml`](../contracts/openapi/admin-management-api.v1.yaml).

Nhóm endpoint:

- `/api/admin/users`, `/api/admin/subjects`, `/api/admin/terms`;
- `/api/admin/classes` và `/api/admin/classes/{classId}/lecturers`;
- `/api/admin/subjects/{subjectId}/chapters` và nội dung bài học;
- `/api/admin/practice-questions`, `/api/admin/questions/unrouted`, `/api/admin/audit-logs`;
- `/api/lecturer/classes/{classId}/question-queue` và claim/release;
- `/api/lecturer/classes/{classId}/analytics`.

## Điều kiện hoàn thành

- Không còn authorization dựa trên một `course_classes.lecturer_id` duy nhất.
- Admin CRUD được các thực thể trong phạm vi đã chốt và mọi mutation có audit log.
- Giảng viên không thể đọc hoặc ghi dữ liệu lớp ngoài phân công.
- Claim hỏi đáp chống được hai request đồng thời.
- Thống kê không cộng lẫn dữ liệu giữa các lớp cùng môn.
- Seed demo chạy lặp lại không nhân bản và bị vô hiệu trong production.
- Format, lint, contract test, unit/integration test và build đều đạt.

## Ranh giới hiện tại

- Microsoft Outlook/Entra chỉ cung cấp danh tính; đồng bộ Microsoft Graph chưa nằm trong thay đổi này.
- Contract RAG/chatbot không thay đổi.
- Import Word/Excel cho chương và bài học chưa thực hiện.
- Câu hỏi trắc nghiệm tiếp tục hỗ trợ nhập tay và CSV.
