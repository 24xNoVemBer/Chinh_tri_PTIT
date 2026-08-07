# DB-5 — PostgreSQL staging cutover

**Bắt đầu:** 2026-08-08  
**Nhánh:** `feature/db5-postgres-staging`  
**Trạng thái:** DB-5.0 đang triển khai

## Phạm vi

DB-5 kiểm chứng toàn bộ backend trên PostgreSQL trước khi tích hợp staging PTIT:

1. Khóa baseline và bảo toàn SQLite.
2. Dựng PostgreSQL local staging.
3. Chuyển dữ liệu demo an toàn.
4. Chạy API parity/E2E.
5. Đo tải và pool saturation.
6. Diễn tập backup, restore và rollback.

Không thuộc DB-5: Outlook SSO thật, RAG provider thật, thay đổi UI và production cutover.

## DB-5.0 — Baseline ngày 2026-08-08

- SQLite source: `data/ptit-teaching-assistant.sqlite`.
- Backup trước khi chạy baseline: `data/backups/ptit-teaching-assistant-db5-20260808.sqlite`.
- Snapshot local: `data/ptit-snapshot-db5.json`.
- Snapshot có 25 bảng và 538 rows.
- Backup/snapshot được ignore khỏi Git.

### SHA-256

| Artifact                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| SQLite source sau export     | `AFCC17F52BA8F9794C274C46F2168A19F4482EE1D1115ECEED065B85810745AB` |
| SQLite backup trước baseline | `DDEA694E99C873849F66BD52C8133D12DDAFA82FB5D7026FCB9788B74F829F84` |
| JSON snapshot                | `8B2C5239370E854F108C98006BF1F1B60E1831CFAFAE81250574B3859567C68F` |

SQLite source và backup có hash khác nhau vì backup được tạo trước khi các lệnh baseline/export mở database. Không ghi đè backup ban đầu.

### Row count

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

## Quyết định dữ liệu cho DB-5.2

- Không import `sessions`; token cũ không được chuyển môi trường.
- Không import `audit_logs` development vào staging mặc định.
- Dữ liệu nghiệp vụ dự kiến: 141 rows sau khi loại hai bảng trên.
- Import chỉ được chạy trên database trống, trừ khi truyền cờ override rõ ràng.
- Migration `001_initial.sql` không được sửa; thay đổi schema mới phải dùng migration `002+`.

## Blocker hiện tại cho DB-5.1

Máy có PostgreSQL 17.9 nhưng chưa có credential quản trị để tạo database và role staging. Cần một trong hai:

- tài khoản có quyền `CREATE DATABASE` và `CREATE ROLE`; hoặc
- database/role staging được tạo sẵn và cung cấp `DATABASE_URL` qua biến môi trường.

Không ghi connection string hoặc password thật vào tài liệu/Git.
