# DB-4B — Async repository và PostgreSQL runtime

**Ngày:** 2026-08-04  
**Trạng thái:** hoàn tất migration code; chờ chạy parity/load test trên PostgreSQL staging  
**Phạm vi:** chuyển toàn bộ route nghiệp vụ và live RAG sang query API async, giữ nguyên HTTP contract.

## Đã triển khai

- Thêm [`server/repositoriesAsync.js`](../server/repositoriesAsync.js) cho các vertical slice:
  - quản lý lớp, sinh viên, lịch học và học liệu;
  - câu hỏi, câu trả lời, hàng đợi review RAG;
  - dashboard, tiến độ, tra cứu và lịch sử sinh viên.
- `server/app.js` dùng async repositories cho cả SQLite và PostgreSQL; repository sync cũ chỉ giữ để tương thích test/consumer cũ.
- Chuyển live RAG sang query API async trong [`server/rag/liveRepository.js`](../server/rag/liveRepository.js).
- Transaction nhiều bước dùng `db.transaction(async callback)`; SQLite adapter đã hỗ trợ commit/rollback sau Promise, PostgreSQL dùng pooled connection riêng cho mỗi transaction.
- Bật runtime adapter trong [`server/db/runtime.js`](../server/db/runtime.js) và [`server/index.js`](../server/index.js):
  - `DATABASE_DRIVER=sqlite` dùng file SQLite và seed development;
  - `DATABASE_DRIVER=postgres` dùng `pg` pool, không seed dữ liệu demo.
- Nhận diện lỗi unique constraint của SQLite và PostgreSQL (`23505`) để giữ response `409 CONFLICT`.

## Contract không đổi

- Endpoint, status code, payload và RBAC giữ nguyên.
- Cookie `ptit_session`, schema request/response và RAG contract không đổi.
- SQLite vẫn là mặc định cho development; PostgreSQL chỉ hoạt động khi đã migrate schema và cấu hình `DATABASE_URL`.

## Kiểm thử đã chạy

- Full Vitest: 19 test files, 68/68 tests passed.
- Async repository parity trên SQLite và API regression đều đạt.
- Runtime adapter test xác nhận tạo được SQLite client và PostgreSQL pool client mà không cần kết nối thật.
- Prettier, contract validation và production build cần chạy lại trước khi merge.

## Chưa thể coi là staging sign-off

Môi trường hiện tại chưa có PostgreSQL staging thật nên chưa xác nhận:

1. Chạy `npm run db:migrate` và `npm run db:validate:staging` trên server PostgreSQL của PTIT.
2. Import snapshot và đối chiếu row count/index với SQLite baseline.
3. API parity test với dữ liệu staging.
4. Pool saturation, latency p95/p99 và retry khi database/provider chậm.

## Quy trình staging

```powershell
$env:DATABASE_DRIVER="postgres"
$env:DATABASE_URL="postgres://user:password@host:5432/ptit"
npm run db:migrate
npm run db:validate:staging
npm run db:import -- data/ptit-snapshot.json
npm run test
npm run build
npm start
```

Không dùng snapshot demo làm dữ liệu production nếu chưa được PTIT duyệt về retention, dữ liệu cá nhân và backup.
