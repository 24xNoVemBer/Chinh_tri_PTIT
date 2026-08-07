# DB-5 — PostgreSQL staging cutover

**Bắt đầu:** 2026-08-08  
**Nhánh:** `feature/db5-postgres-staging`  
**Trạng thái:** DB-5.4 tooling hoàn thành; chưa chạy PostgreSQL staging thật

## Phạm vi

DB-5 kiểm chứng backend trên PostgreSQL trước khi tích hợp staging PTIT:

1. khóa baseline và bảo toàn SQLite;
2. harden PostgreSQL runtime;
3. chuyển dữ liệu demo an toàn;
4. chạy API read/write parity;
5. đo tải và pool saturation;
6. diễn tập backup, restore và rollback.

Không thuộc DB-5: Outlook SSO thật, RAG provider thật, thay đổi UI và production cutover.

## Tiến độ

| Mốc                             | Trạng thái   | Kết quả                                                                              |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| DB-5.0 baseline                 | Hoàn thành   | Backup SQLite, inventory 25 bảng/538 rows và checksum                                |
| DB-5.1 artifact offline         | Hoàn thành   | Snapshot 141 rows, bỏ runtime data, vô hiệu credential, importability và fingerprint |
| DB-5.2 target safety            | Hoàn thành   | Xác nhận URL host/database/user, xác minh identity từ server và CLI fail-closed      |
| DB-5.3 import/credential safety | Hoàn thành   | Tách migrate/import, preflight schema rỗng và kích hoạt credential riêng             |
| PostgreSQL staging execution    | Đang chờ     | Chưa có credential database/role staging để chạy runbook thật                        |
| DB-5.4 parity/load              | Tooling xong | Fingerprint, TLS, parity/load guards hoàn thành; staging chưa chạy                   |
| DB-5.5 rollback                 | Chưa chạy    | Cần database staging để diễn tập backup/restore/rollback                             |

## DB-5.0 — Baseline ngày 2026-08-08

- SQLite source: `data/ptit-teaching-assistant.sqlite`.
- Backup: `data/backups/ptit-teaching-assistant-db5-20260808.sqlite`.
- Snapshot đầy đủ: `data/ptit-snapshot-db5.json`.
- Snapshot có 25 bảng và 538 rows.
- Backup/snapshot được ignore khỏi Git.

### SHA-256 tại thời điểm capture

| Artifact                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| SQLite source sau export     | `AFCC17F52BA8F9794C274C46F2168A19F4482EE1D1115ECEED065B85810745AB` |
| SQLite backup trước baseline | `DDEA694E99C873849F66BD52C8133D12DDAFA82FB5D7026FCB9788B74F829F84` |
| JSON snapshot đầy đủ         | `8B2C5239370E854F108C98006BF1F1B60E1831CFAFAE81250574B3859567C68F` |

Đây là hash lịch sử tại thời điểm capture; không thay bằng hash của SQLite runtime đang tiếp tục
thay đổi.

### Row count baseline

| Table               | Rows | Table                   | Rows |
| ------------------- | ---: | ----------------------- | ---: |
| approved_sources    |    4 | audit_logs              |  278 |
| chapters            |   15 | class_lessons           |    6 |
| class_materials     |    2 | course_classes          |    2 |
| enrollment_profiles |    6 | enrollments             |    6 |
| learning_progress   |    5 | lecturer_answers        |    2 |
| lessons             |   30 | material_versions       |    6 |
| materials           |    6 | mock_response_templates |    5 |
| mock_responses      |    1 | questions               |   10 |
| rag_citations       |    4 | rag_requests            |    4 |
| rag_responses       |    4 | rag_reviews             |    0 |
| schema_meta         |    1 | search_history          |   10 |
| sessions            |  119 | subjects                |    5 |
| users               |    7 |                         |      |

## DB-5.1 — Snapshot staging-safe

- File local: `data/ptit-staging-snapshot-db5.json`.
- SHA-256: `083FC33331353312172FD23C3785005E477B02801B3BB2387CE056CF5CEC0CC2`.
- Tổng: 141 rows.
- Toàn bộ 7 giá trị users.password_hash đã được thay bằng sentinel vô hiệu
  disabled$staging-import; không mang mật khẩu demo sang staging.
- Offline dry-run đã import thử toàn bộ snapshot vào database dùng một lần, kiểm tra khóa ngoại,
  unique/check constraint và kiểu dữ liệu tương thích PostgreSQL.
- SHA-256 fingerprint được tính độc lập cho từng bảng, không phụ thuộc thứ tự dòng hoặc thứ tự key;
  dry-run xuất fingerprints để dùng cho bước đối chiếu PostgreSQL.
- `sessions=0`, `audit_logs=0`; token và audit development không đi sang staging.
- Validator bắt buộc đủ 25 bảng, row hợp lệ, có users/subjects và không có runtime data.
- Export mở SQLite read-only và đọc cả 25 bảng trong một transaction point-in-time.
- Import mặc định khóa các bảng PostgreSQL, yêu cầu target trống trong cùng transaction và fail khi conflict.

## DB-5.2 — PostgreSQL target safety

- db:migrate, db:import khi không dùng dry-run và db:validate:staging bắt buộc khai báo riêng
  DATABASE_CONFIRM_HOST, DATABASE_CONFIRM_NAME và DATABASE_CONFIRM_USER.
- Bộ xác nhận được đối chiếu với DATABASE_URL trước khi tạo kết nối. Sau khi kết nối, script dùng
  current_database() và current_user để xác minh lại identity từ PostgreSQL trước khi chạy migration,
  import hoặc truy vấn validation.
- URL không được phép dùng query parameter để ghi đè host, port, database hoặc user.
- Các database hệ thống postgres, template0 và template1 luôn bị chặn.
- Target có dấu hiệu production cần DATABASE_ALLOW_PRODUCTION_ADMIN=true theo quy trình break-glass.
- CLI dùng strict parsing; option sai chính tả bị từ chối thay vì rơi vào luồng ghi dữ liệu.
- Chưa có kết nối hay thay đổi nào trên PostgreSQL thật tại checkpoint này.

## DB-5.3 — Import và credential staging

- db:import không còn tự chạy migration. Operator phải chạy db:migrate thành công trước.
- Preflight chỉ đọc yêu cầu đúng toàn bộ application tables, không có bảng public ngoài phạm vi,
  migration version/name/checksum phải khớp và target nghiệp vụ phải rỗng.
- Khi bắt đầu transaction import, PostgreSQL khóa toàn bộ application tables rồi kiểm tra rỗng lần
  nữa trước insert để chống thay đổi xen giữa preflight và import.
- Hai cờ allow-existing và allow-runtime-data cần thêm xác nhận thứ hai qua protected environment.
- ANALYZE sau import chỉ áp dụng cho application tables, không quét toàn database.
- Snapshot giữ toàn bộ user ở trạng thái credential vô hiệu. Sau validation, lệnh
  db:credentials:staging chỉ kích hoạt đúng một sinh viên và một giảng viên trong một transaction.
- Password staging phải dài 16–128 ký tự, khác nhau, email thuộc ptit.edu.vn và không được truyền
  qua command line hoặc ghi vào log.
- Script từ chối ghi đè credential đã hoạt động; các tài khoản demo còn lại tiếp tục bị vô hiệu.
- Chưa có kết nối hay thay đổi nào trên PostgreSQL thật tại checkpoint này.

## DB-5.4 — Exact parity, TLS và load safety

- `db:validate:staging` đối chiếu cả row count và SHA-256 content fingerprint từng bảng; dữ liệu
  bị thay đổi nhưng giữ nguyên số dòng vẫn làm validation thất bại. Toàn bộ 25 bảng được đọc trong`n  một transaction PostgreSQL `REPEATABLE READ, READ ONLY` để có snapshot nhất quán.
- Validator dùng cùng schema/migration guard đã kiểm thử ở DB-5.2/DB-5.3 và báo transport TLS
  thật từ `pg_stat_ssl`.
- PostgreSQL production chỉ khởi động với `DATABASE_SSL_MODE=verify-full` và CA file riêng;
  `rejectUnauthorized=true`. Query/fragment trong `DATABASE_URL` bị chặn để không ghi đè cấu hình.
- API parity authenticated yêu cầu đủ credential của hai vai trò. Chỉ `--health-only` mới được bỏ
  qua route đăng nhập; option lạ bị từ chối.
- Write parity yêu cầu đồng thời allow-write, xác nhận database disposable và hostname chính xác.
- Load profile cao yêu cầu xác nhận allow, staging disposable và hostname. Generator tính trước
  số request; mặc định chặn workload vượt 20.000 request trước khi gửi lưu lượng.
- Smoke/dry-run và 23 test files với 121/121 tests chạy offline; chưa có số liệu PostgreSQL
  staging thật tại checkpoint này.

## Runbook staging an toàn

`.env.staging.example` chỉ là mẫu. Các script tự load `.env`, không tự load file mẫu. Tạo secret
theo kênh quản lý cấu hình của PTIT; không commit connection string, password hoặc CA file.
PostgreSQL staging/production phải cấp CA tin cậy tại DATABASE_SSL_CA_PATH.

### 1. Xác nhận đúng target bằng truy vấn chỉ đọc

Điền đủ bốn biến DATABASE_CONFIRM_HOST, DATABASE_CONFIRM_NAME, DATABASE_CONFIRM_USER và
DATABASE_ALLOW_PRODUCTION_ADMIN trong secret environment. Giá trị phải khớp chính xác với
DATABASE_URL; xem mẫu tại .env.staging.example. Truy vấn psql dưới đây là bước kiểm tra vận hành bổ
sung, không thay thế guard tự động trong script.

```powershell
psql "$env:DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();"
```

### 2. Backup và tạo snapshot

```powershell
npm run db:export -- data/ptit-staging-snapshot-db5.json
Get-FileHash -Algorithm SHA256 data/ptit-staging-snapshot-db5.json
npm run db:import -- data/ptit-staging-snapshot-db5.json --dry-run
```

`--dry-run` chỉ đọc/validate snapshot, không kết nối và không chạy migration.

### 3. Migrate, import và đối chiếu trước khi kích hoạt đăng nhập

```powershell
npm run db:migrate
npm run db:import -- data/ptit-staging-snapshot-db5.json
npm run db:validate:staging -- data/ptit-staging-snapshot-db5.json
```

Ba lệnh là các bước tách biệt; db:import không tạo hoặc sửa schema. Import kiểm tra schema,
migration metadata và target rỗng trước transaction. Chạy validation trước khi kích hoạt
credential vì các bước đăng nhập sau đó sẽ tạo sessions và audit logs.

### 4. Kích hoạt hai tài khoản parity staging

Nạp STAGING_STUDENT_EMAIL, STAGING_STUDENT_PASSWORD, STAGING_LECTURER_EMAIL và
STAGING_LECTURER_PASSWORD từ secret manager, sau đó đặt
STAGING_CREDENTIAL_ROTATION_CONFIRM=true cho đúng lần chạy đã được duyệt.

```powershell
npm run db:credentials:staging
```

Lệnh chỉ xuất id/email/role đã cập nhật; không xuất password hoặc password hash.

### 5. Parity và load

```powershell
npm run api:parity
npm run load:test:smoke
npm run load:test:baseline
npm run load:test:exam-peak
```

Xem guard và cách xác nhận target trong [API_PARITY.md](./API_PARITY.md) và
[LOAD_TEST.md](./LOAD_TEST.md).

## Break-glass flags

Chỉ dùng khi có phê duyệt và backup:

- `db:export -- --include-runtime-data`: đưa session/audit development vào snapshot;
- `db:import -- --allow-runtime-data`: cần thêm `DB_ALLOW_RUNTIME_DATA_IMPORT=true`;
- `db:import -- --allow-existing`: cần thêm `DB_ALLOW_EXISTING_IMPORT=true`;
- `db:validate:staging -- --schema-only`: chỉ kiểm tra schema, không xác nhận dữ liệu.

Luồng bình thường không dùng bất kỳ cờ nào ở trên.

## Blocker còn lại

PostgreSQL 17.9 local đang lắng nghe ở cổng 5432 nhưng chưa có credential quản trị. Để tiếp tục
cần một trong hai:

- tài khoản có quyền tạo database/role staging; hoặc
- database/role đã tạo sẵn và `DATABASE_URL` được cấp qua secret environment.

Sau khi có credential, công việc còn lại là chạy runbook thật, lưu report parity/load, kiểm tra
query plan/pool saturation và diễn tập backup → restore → rollback.
