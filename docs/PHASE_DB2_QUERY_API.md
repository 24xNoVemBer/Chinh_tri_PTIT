# DB-2 — Query API và PostgreSQL adapter

**Ngày:** 2026-08-04  
**Trạng thái:** adapter đã sẵn sàng, runtime production chưa cutover  
**Phạm vi:** chuẩn hóa query API và tạo kết nối PostgreSQL có pool

## Đã triển khai

- SQLite `DatabaseClient` có query API trung lập:
  - `one(sql, params)`
  - `many(sql, params)`
  - `execute(sql, params)`
  - `transaction(callback)`
- Thêm [`PostgresDatabaseClient`](../server/db/postgres.js) dùng `pg` và connection pool.
- PostgreSQL adapter hỗ trợ:
  - query một/nhiều dòng;
  - execute trả về `rowCount`;
  - transaction `BEGIN`/`COMMIT`/`ROLLBACK` trên pooled connection;
  - chuyển placeholder hiện tại từ `?` sang `$1`, `$2`, ... ngoài string literal.
- Thêm cấu hình runtime:

```env
DATABASE_DRIVER=sqlite
DATABASE_URL=
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT_MS=10000
```

- SQLite vẫn là mặc định. Khi đặt `DATABASE_DRIVER=postgres`, runtime dùng PostgreSQL pool sau khi đã chạy migration; không có fallback âm thầm sang SQLite.

## Kiểm thử

- SQLite query boundary vẫn chạy qua adapter hiện tại.
- PostgreSQL adapter được test bằng pool-compatible fake, không cần PostgreSQL server trong CI.
- Đã kiểm thử commit, rollback, release connection và placeholder conversion.

## Giới hạn còn lại sau DB-2

- Async repository và runtime wiring đã được hoàn tất ở [DB-4B](./PHASE_DB4B_ASYNC_REPOSITORIES.md).
- Chưa chạy migration/import/parity/load test trên PostgreSQL staging thật.
- Chưa đánh giá query plan và capacity pool trên hạ tầng PTIT.

## Tiêu chí nghiệm thu

- [x] Có query API trung lập trên SQLite adapter.
- [x] Có PostgreSQL pool adapter thật qua package `pg`.
- [x] Có transaction lifecycle và error preservation.
- [x] SQLite là default và server không silent fallback khi chọn PostgreSQL.
- [x] Test/lint/build hiện tại vẫn đạt.
