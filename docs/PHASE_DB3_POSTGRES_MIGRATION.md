# DB-3 — PostgreSQL schema và migration runner

**Ngày:** 2026-08-04  
**Trạng thái:** hoàn tất migration foundation và runtime wiring, chờ staging sign-off  
**Phạm vi:** tạo schema production PostgreSQL và quy trình apply migration có checksum.

## Đã triển khai

- Migration đầu tiên tại [`server/db/migrations/001_initial.sql`](../server/db/migrations/001_initial.sql), bao phủ 25 bảng nghiệp vụ và các index chính từ SQLite baseline.
- `runMigrations` tạo `schema_migrations`, chạy migration theo thứ tự, lưu SHA-256 checksum và dừng khi phát hiện drift.
- ID vẫn là `TEXT`, timestamp vẫn là `TEXT`, `approved_sources.is_approved` dùng `SMALLINT` 0/1 để giữ tương thích response.
- Có lệnh `DATABASE_DRIVER=postgres DATABASE_URL=postgres://... npm run db:migrate`.
- Async repositories và live RAG đã được chuyển ở [DB-4B](./PHASE_DB4B_ASYNC_REPOSITORIES.md).
- `server/index.js` đã bật runtime adapter theo `DATABASE_DRIVER`; SQLite vẫn là mặc định.

## Quy trình staging bắt buộc

1. Tạo database PostgreSQL riêng cho staging.
2. Chạy `npm run db:migrate` với `DATABASE_DRIVER=postgres`.
3. Đối chiếu bảng/index với [DB-0 baseline](./PHASE_DB0_BASELINE.md).
4. Import dữ liệu bằng data migration riêng, không đưa seed demo vào production.
5. Chạy contract/API/load test trước khi phát hành.

## Chưa sign-off

- Chưa có data cutover production hoặc rollback rehearsal.
- Chưa đánh giá query plan và capacity pool trên hạ tầng thật.
- Chưa có số liệu API parity và p95/p99 từ PostgreSQL staging.

## Tiêu chí nghiệm thu foundation

- [x] Có migration SQL PostgreSQL phiên bản đầu.
- [x] Có migration table và checksum drift detection.
- [x] Có transaction per migration.
- [x] Có test idempotency, ordering và checksum mismatch.
- [x] Có async repository boundary và runtime wiring.
- [ ] Có staging parity/load-test report.

## Data migration dry-run

- `server/db/dataMigration.js` định nghĩa snapshot format version `1` và thứ tự 24 bảng dữ liệu theo khóa ngoại.
- `npm run db:export` tạo snapshot JSON từ SQLite hiện tại.
- `npm run db:import` chạy schema migration trước, sau đó import snapshot theo transaction và `ON CONFLICT DO NOTHING`.
- Snapshot demo không nên dùng làm dữ liệu production nếu chưa được PTIT duyệt retention, dữ liệu cá nhân và quy trình backup.
