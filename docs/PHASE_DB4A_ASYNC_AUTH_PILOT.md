# DB-4A — Async auth boundary pilot

**Ngày:** 2026-08-04  
**Trạng thái:** hoàn tất pilot trên SQLite, đã mở rộng sang async repository ở DB-4B  
**Phạm vi:** chuyển luồng xác thực sang query API async mà không đổi contract HTTP.

## Đã triển khai

- Thêm các hàm async trong [`server/auth.js`](../server/auth.js): `createSessionAsync`, `authenticateRequestAsync`, `destroySessionAsync`.
- Thêm [`writeAudit`](../server/db/audit.js) dùng `execute()` trung lập.
- `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` trong `server/app.js` đi qua async query API.
- SQLite vẫn hoạt động vì `await` nhận được cả giá trị sync; PostgreSQL adapter có Promise API tương ứng.

## Contract không đổi

- Cookie `ptit_session` giữ nguyên.
- HTTP status/error code/RBAC giữ nguyên.
- Password hashing vẫn dùng `scrypt`.
- Route nghiệp vụ đã có async repository ở [DB-4B](./PHASE_DB4B_ASYNC_REPOSITORIES.md); module sync cũ vẫn giữ để tương thích consumer cũ.

## Kiểm thử

- Test tạo → xác thực → hủy session qua query API.
- Auth được kiểm tra trong full API regression trên SQLite.
- Chi tiết migration repository và runtime PostgreSQL xem [DB-4B](./PHASE_DB4B_ASYNC_REPOSITORIES.md).

## Giới hạn còn lại

- Login và audit vẫn là hai thao tác riêng; nếu cần tính nguyên tử tuyệt đối nên gộp vào transaction auth ở phase hardening.
- PostgreSQL runtime đã được wiring nhưng chưa có staging sign-off.
- Chưa có số liệu load test thực tế.
