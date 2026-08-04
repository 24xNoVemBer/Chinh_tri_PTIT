# DB-1 — Database client boundary

**Ngày:** 2026-08-04  
**Trạng thái:** Hoàn tất lớp boundary, vẫn dùng SQLite adapter  
**Phạm vi:** tách driver khỏi application wiring trước khi chuyển sang PostgreSQL

## Đã triển khai

- Thêm `DatabaseClient` tại [`server/db/client.js`](../server/db/client.js).
- `createDatabase()` hiện trả về SQLite client adapter thay vì để application giữ trực tiếp `DatabaseSync`.
- Client có các capability hiện tại:
  - `prepare(sql)` — compatibility surface để chuyển repository từng phần.
  - `exec(sql)` — schema/pragma và legacy SQL.
  - `transaction(callback, { mode })` — transaction boundary có commit/rollback tự động.
  - `close()` — lifecycle boundary.
  - `dialect` — nhận diện adapter (`sqlite` hiện tại).
- Thêm test commit/rollback và dialect tại `server/db/client.test.js`.

## Ranh giới sau DB-1

```text
Application / repositories / auth / RAG
                 |
           DatabaseClient
                 |
        SQLite DatabaseSync adapter
```

SQL chưa được đổi sang PostgreSQL ở DB-1. `prepare()` vẫn được giữ tạm thời để không làm thay đổi API và test hiện có. DB-2 sẽ thay dần các call site bằng query API trung lập hơn và bổ sung PostgreSQL adapter.

## Không thay đổi

- Không đổi schema hoặc seed.
- Không đổi API response, status code, error code hay RBAC.
- Không thay đổi cookie/session contract.
- Không cutover database production.

## Tiêu chí nghiệm thu

- [x] `createDatabase()` trả về một client có `dialect: 'sqlite'`.
- [x] Transaction helper commit khi callback thành công.
- [x] Transaction helper rollback và giữ nguyên lỗi gốc khi callback thất bại.
- [x] Test cũ vẫn chạy trên client boundary.
- [ ] Chưa có PostgreSQL adapter — thuộc DB-2.
