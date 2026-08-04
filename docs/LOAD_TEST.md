# API load test

Script `scripts/load-test.mjs` tạo phiên đăng nhập và gọi `/api/auth/me` cho nhiều virtual users. Script chỉ đo HTTP/API boundary, không thay thế load test PostgreSQL/RAG trong staging.

```powershell
npm run load:test -- --base-url http://127.0.0.1:3001 --users 1000 --concurrency 100
```

Có thể đặt `LOAD_TEST_EMAIL`, `LOAD_TEST_PASSWORD`, `LOAD_TEST_USERS`, `LOAD_TEST_CONCURRENCY` thay cho tham số dòng lệnh. Kết quả in JSON gồm throughput, số lỗi và min/p50/p95/p99/max latency cho login và `/api/auth/me`.

Khuyến nghị chạy theo thứ tự:

1. Smoke test với 10 users.
2. 1.000 users đồng thời trong staging.
3. Burst 2.000–3.000 users gần kỳ thi.
4. Lặp lại khi bật RAG thật để đo riêng database pool và provider latency.

Không chạy tải 1.000–3.000 users trên máy development hoặc production nếu chưa có cửa sổ bảo trì và người phụ trách hạ tầng giám sát.
