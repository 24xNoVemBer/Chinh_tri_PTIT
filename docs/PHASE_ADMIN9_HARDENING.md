# Phase 9 — Hardening và nghiệm thu Plan A

**Ngày kiểm chứng:** 12/08/2026

**Nhánh:** `feature/db5-postgres-staging`

**Trạng thái:** hoàn thành ở mức code và development; hạ tầng staging thật được theo dõi riêng

## Kết luận

Plan A đã hoàn thành theo phạm vi quản trị môn học, lớp tín chỉ, phân công nhiều giảng viên,
ngân hàng câu hỏi, hàng đợi hỏi đáp chung và thống kê theo lớp. Toàn bộ kiểm tra quyền quan trọng
được thực hiện ở backend; giao diện chỉ phản ánh quyền đã được API xác nhận.

Việc chưa có PostgreSQL staging credential, CA, deployment endpoint và credential pool PTIT không
làm thay đổi kết luận hoàn thành Plan A ở mức code. Các điều kiện đó là cổng nghiệm thu vận hành
trước production và vẫn được ghi rõ là chưa thực hiện.

## Đối chiếu điều kiện hoàn thành

| Điều kiện                                                              | Kết quả | Bằng chứng chính                                                                                                  |
| ---------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| Authorization không dựa trên một `course_classes.lecturer_id` duy nhất | Đạt     | Runtime dùng `class_lecturer_assignments`; `server/rbac.test.js`; cột cũ chỉ còn cho migration/seed tương thích   |
| Admin CRUD đúng phạm vi và mutation có audit                           | Đạt     | `server/adminRepository.js`, `server/admin.test.js`, OpenAPI quản trị                                             |
| Nhiều giảng viên trong một lớp, tối đa một lead                        | Đạt     | unique partial index trong migration 006 và `server/db/adminClassSchema.test.js`                                  |
| Giảng viên không đọc/ghi lớp ngoài phân công                           | Đạt     | `server/rbac.test.js`, `server/practice.test.js`, `server/questionQueue.test.js`, `server/classAnalytics.test.js` |
| Câu hỏi riêng chỉ do chủ sở hữu sửa; câu dùng chung chỉ đọc            | Đạt     | `server/practice.test.js`                                                                                         |
| Claim hỏi đáp chống hai request đồng thời                              | Đạt     | conditional update và test cạnh tranh trong `server/questionQueue.test.js`                                        |
| Thu hồi phân công trả claim về hàng đợi                                | Đạt     | transaction trong admin repository và `server/admin.test.js`                                                      |
| Thống kê không trộn hai lớp cùng môn                                   | Đạt     | `server/classAnalytics.test.js`                                                                                   |
| Seed demo lặp lại không nhân bản, khóa production                      | Đạt     | `server/db/demoSeed.test.js`; chạy thực tế hai lần trên SQLite development                                        |
| Contract, format, lint, test và build                                  | Đạt     | `npm run check`; 37 test files, 191 tests                                                                         |

## Rà soát dữ liệu và migration

- Migration 006 backfill `course_classes.lecturer_id` thành assignment `lead` và tạo unique partial
  index bảo đảm tối đa một lead đang hoạt động.
- Runtime authorization, danh sách lớp, ngân hàng câu hỏi, hàng đợi hỏi đáp và thống kê đều đọc
  assignment đang hoạt động.
- Cột `course_classes.lecturer_id` chưa bị xóa để hỗ trợ database SQLite cũ và rollback. Không có
  truy vấn authorization trong `server/app.js`, `server/adminRepository.js` hoặc
  `server/repositoriesAsync.js` dựa trên cột này.
- Migration runner kiểm tra thứ tự, tính lặp lại và checksum drift; import PostgreSQL yêu cầu schema
  và migration metadata khớp trước khi ghi.

## Rà soát an toàn và tải

- Session bị vô hiệu khi role, trạng thái hoặc `auth_version` thay đổi.
- Login rate limit được lưu trong database để dùng chung giữa nhiều instance.
- Profile tải đã có: smoke, 1.000 session baseline, login storm và 3.000 session exam peak.
- Profile cao bị khóa nếu thiếu xác nhận staging, hostname, giới hạn request và credential pool.
- Seed demo bị chặn trước khi mở database nếu `NODE_ENV=production`.
- PostgreSQL production yêu cầu TLS `verify-full` và CA riêng.

HTTP smoke cục bộ ngày 12/08/2026 tạo 10 session, dùng 5 session hoạt động và hoàn thành 35/35
request không lỗi. Login p95 là 105,27 ms; nhóm đọc p95 là 37,78 ms. Kết quả chạy trên SQLite
development và chỉ là kiểm tra generator/deployment cục bộ, không phải cam kết hiệu năng.

## Những việc không được tuyên bố là đã nghiệm thu

Các mục sau cần hạ tầng hoặc bàn giao từ PTIT và không thể kiểm chứng chỉ bằng repository:

1. migrate/import trên PostgreSQL staging thật;
2. parity authenticated với dữ liệu staging;
3. tải 1.000–3.000 session và đo p95/p99, connection-pool wait, CPU/RAM/I/O;
4. backup → restore drill và RTO/RPO thực tế;
5. Outlook/Entra SSO thật;
6. RAG endpoint, auth, citation và policy dữ liệu thật.

Runbook tương ứng nằm tại `PHASE_DB5_POSTGRES_STAGING.md`, `LOAD_TEST.md`,
`PHASE_DB5_BACKUP_RESTORE.md`, `OUTLOOK_SSO_INTEGRATION.md` và
`CHATBOT_BACKEND_INTEGRATION.md`.

## Lệnh kiểm chứng

```bash
npm run check
npm run db:seed:demo -- --confirm-demo-seed
```

Chỉ chạy parity, load profile cao và restore drill sau khi đội hạ tầng cấp đúng target staging
disposable cùng secret ngoài Git.
