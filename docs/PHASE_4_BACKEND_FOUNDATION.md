# Giai đoạn 4 — Backend integration foundation

Lát cắt đầu tiên của Giai đoạn 4 đã được triển khai mà không thay đổi API demo SQLite.

## Đã có

- `server/runtimeConfig.js`: đọc và kiểm tra cấu hình runtime.
- `server/rag/client.js`: gọi RAG nội bộ theo contract, truyền service token, `X-Request-ID` và `Idempotency-Key`.
- Timeout bằng `AbortController`, retry có giới hạn cho 429/502/503/504 và lỗi mạng.
- Không retry lỗi `INVALID_CITATION`, `SAFETY_BLOCKED` hoặc `VALIDATION`.
- Validate terminal answer và citation allow-list trước khi trả kết quả cho application layer.
- `GET /api/ready`: kiểm tra database và readiness RAG; khi RAG chưa bật trả `rag: disabled`.

## Bật RAG adapter ở local

```env
RAG_ENABLED=true
RAG_BASE_URL=http://127.0.0.1:8787
RAG_SERVICE_TOKEN=mock-service-token
RAG_TIMEOUT_MS=30000
RAG_MAX_RETRIES=2
RAG_RETRY_DELAY_MS=100
```

Khởi động mock:

```bash
npm run mock:rag
```

Trong production, `RAG_BASE_URL` phải là endpoint nội bộ dùng HTTPS; không đưa token vào frontend hoặc log.

## Chưa bật trong lát cắt này

- Chưa thay `/api/student/chat` demo bằng RAG thật.
- Chưa thêm PostgreSQL/Redis/queue production.
- Chưa cấu hình Microsoft Entra production.

Các bước này chỉ thực hiện sau khi backend và chatbot team xác nhận payload thực tế qua contract tests.
