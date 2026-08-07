# DB-5.5 — PostgreSQL backup, restore và rollback drill

**Trạng thái:** tooling hoàn thành; chưa chạy trên PostgreSQL staging thật
**Nhánh:** `feature/db5-postgres-staging`

## Mục tiêu

- Tạo backup PostgreSQL custom archive trước parity/load/cutover.
- Chứng minh archive đọc được và không bị thay đổi bằng SHA-256 sidecar manifest.
- Restore vào database drill riêng, không restore đè source staging.
- Xác minh identity, TLS, application schema và migration metadata sau restore.
- Có quyết định rollback rõ ràng trước khi production cutover.

## Guard bắt buộc

- Source backup dùng cùng `DATABASE_CONFIRM_HOST/NAME/USER` và TLS `verify-full` như DB-5.4.
- Archive chỉ được tạo/đọc bên trong `data/backups` và phải có đuôi `.dump`.
- File có sẵn không bị overwrite; backup lỗi sẽ xóa đúng partial archive vừa tạo.
- Password không xuất hiện trong argument hoặc log; `pg_dump`/`pg_restore` nhận qua `PGPASSWORD`.
- Restore target dùng bộ `RESTORE_*` riêng, luôn chạy như production TLS `verify-full`.
- Tên restore database phải chứa `restore`, `drill`, `disposable`, `temporary` hoặc `tmp`.
- Restore database phải khác tên database nguồn trong manifest.
- `RESTORE_CONFIRM_DISPOSABLE=true` và `RESTORE_CONFIRM_CLEAN=true` phải cùng được bật.
- Production-like target bị chặn; không có break-glass production trong restore script.

## Điều kiện trước khi chạy

1. Cài PostgreSQL client tools cùng major version với server; hiện máy phát triển có `pg_dump` và
   `pg_restore` 17.9.
2. Cấp source staging URL/CA và ba biến xác nhận target.
3. Tạo sẵn database restore drill riêng cùng role có quyền tạo/drop object trong database đó.
4. Cấp URL/CA và ba biến `RESTORE_CONFIRM_HOST/NAME/USER` của restore target.
5. Dừng write workload hoặc ghi rõ thời điểm/RPO của backup cần kiểm chứng.

## Tạo backup staging

```powershell
npm run db:backup:staging
```

Có thể truyền tên archive nhưng file vẫn phải nằm trong `data/backups`:

```powershell
npm run db:backup:staging -- data/backups/pre-load-db5.dump
```

Lệnh thực hiện:

1. xác minh database/user/host từ PostgreSQL và transport TLS;
2. kiểm tra exact application schema và migration metadata;
3. chạy `pg_dump --format=custom --no-owner --no-privileges`;
4. dùng `pg_restore --list` xác nhận archive đọc được;
5. tạo `*.dump.manifest.json` chứa size, SHA-256, source identity, TLS và migration summary.

Cả `.dump` và manifest nằm trong thư mục ignored khỏi Git. Sao chép hai file cùng nhau sang kho
backup được PTIT phê duyệt; không chỉ giữ trên máy chạy lệnh.

## Restore drill

Khai báo target riêng:

```powershell
$env:RESTORE_DATABASE_URL = "postgres://ptit_restore:...@db-restore.example.ptit.edu.vn:5432/ptit_restore_drill"
$env:RESTORE_DATABASE_SSL_MODE = "verify-full"
$env:RESTORE_DATABASE_SSL_CA_PATH = "config/secrets/ptit-postgres-ca.pem"
$env:RESTORE_CONFIRM_HOST = "db-restore.example.ptit.edu.vn:5432"
$env:RESTORE_CONFIRM_NAME = "ptit_restore_drill"
$env:RESTORE_CONFIRM_USER = "ptit_restore"
$env:RESTORE_CONFIRM_DISPOSABLE = "true"
$env:RESTORE_CONFIRM_CLEAN = "true"

npm run db:restore:drill -- data/backups/pre-load-db5.dump
```

Script xác minh manifest/checksum trước khi kết nối. `pg_restore` chạy `--clean --if-exists`,
`--single-transaction` và `--exit-on-error`; lỗi SQL sẽ rollback transaction restore. Sau restore,
script xác minh lại connected identity, TLS, đúng application tables và migration checksums.

Restore thành công ở mức database chưa đủ nghiệm thu ứng dụng. Trên deployment trỏ vào restore
target, tiếp tục chạy:

```powershell
npm run api:parity
npm run load:test:smoke
```

## Rollback production

Không chọn in-place restore làm thao tác đầu tiên khi production đang có traffic. Thiết kế ưu tiên:

1. giữ database phiên bản cũ ở trạng thái read-only/không xóa trong cửa sổ cutover;
2. dừng write hoặc bật maintenance mode;
3. đổi secret/config backend về database cũ đã xác minh;
4. restart/roll deployment và kiểm tra `/api/ready` + parity authenticated;
5. chỉ mở traffic sau khi database identity, migration và session policy đúng;
6. quyết định reconcile hoặc loại bỏ write phát sinh sau cutover theo RPO đã được chủ dữ liệu duyệt.

Nếu database cũ không còn dùng được, restore archive vào **database mới**, validate rồi đổi
connection string. Không `pg_restore --clean` trực tiếp lên production đang phục vụ.

## Bằng chứng cần lưu cho drill thật

- commit/tag ứng dụng và migration version;
- thời điểm bắt đầu/kết thúc, operator và ticket phê duyệt;
- archive filename, bytes, SHA-256 và manifest;
- source/restore database identity, PostgreSQL version và TLS cipher;
- thời gian backup/restore, RTO thực tế;
- kết quả schema/migration check, API parity và smoke;
- RPO quan sát được và quyết định xử lý write trong khoảng chuyển đổi;
- ảnh/metrics CPU, I/O, lock, connection và lỗi;
- kết luận pass/fail cùng người duyệt.

## Tiêu chí hoàn thành DB-5.5

- Backup + manifest tạo thành công trên staging thật.
- Restore drill hoàn thành trên target disposable từ đầu đến cuối.
- Exact schema/migration và authenticated parity đạt trên bản restore.
- RTO/RPO được đo và PTIT chấp nhận.
- Rollback switch được diễn tập hoặc phê duyệt bằng runbook có owner.

Hiện các tiêu chí runtime trên chưa thể xác nhận vì chưa có PostgreSQL staging/restore credential,
CA và deployment endpoint thật.
