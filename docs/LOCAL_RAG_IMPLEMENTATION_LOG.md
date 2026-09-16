# Nhật ký triển khai kế hoạch RAG local

## Baseline Đợt A — 14/09/2026

| Hạng mục                     | Giá trị đã kiểm tra                                               |
| ---------------------------- | ----------------------------------------------------------------- |
| Web repository               | `b4d93d4`, nhánh `main`; giữ nguyên worktree chưa commit          |
| MBA_API repository           | `af0bf15`, nhánh `feature/course-rag-langgraph`; không pull/merge |
| Node / npm                   | 24.14.1 / 11.11.0                                                 |
| Python                       | 3.11.9 trong `MBA_API/.venv`                                      |
| FastAPI / Uvicorn / Pydantic | 0.141.1 / 0.29.0 / 2.13.5                                         |
| OpenAI / Qdrant client       | 1.109.1 / 1.15.1                                                  |
| LlamaIndex core / LangGraph  | 0.12.52.post1 / 1.2.11                                            |
| Docker CLI                   | 29.7.2                                                            |
| Pilot data                   | `data/local-rag/pilot.sqlite`; không dùng database thường         |

Không ghi API key, connection string hoặc nội dung secret vào nhật ký này.

### P0

- `scripts/load-test.mjs`: bỏ shebang vì package scripts luôn gọi qua Node và Vite/Rolldown
  không parse được shebang sau bước transform khi module được import bởi Vitest.
- Full suite sau sửa: 38 test files, 198 tests đạt.
- Thêm `npm run local:rag:preflight`: kiểm tra runtime, checkout, fixture, database path,
  Python imports và cổng. Trong sandbox, nested process có thể bị `EPERM`; chạy được ngoài sandbox và đạt.
- Launcher ghi `data/local-rag/runtime.json` khi đang chạy và xóa khi dừng sạch;
  file này chỉ chứa PID/cổng/mode/path DB local, nằm trong thư mục ignored.
- Remote-tracking MBA_API đang có 4 commit sau local (`4ea0c97`, merge `b941db1`,
  `ab027ef`, `9aa131a`), thay đổi 11 file với 1.130 dòng thêm/458 dòng xóa,
  gồm Langfuse và thay đổi lớn ở `course_langgraph.py`, `load_chat.py`, `main.py`.
  Chưa đủ an toàn để merge mù; cần review diff/tracing privacy trước khi sửa core ở P2–P4.

### P1

- Dùng model `OPENAI_MODEL` đã cấu hình và embedding `text-embedding-3-large`
  khớp code MBA_API hiện tại; không tự thay model.
- Thêm probe có flag xác nhận, tối đa một embedding và một completion, timeout 15 giây, không retry.
- Tách lỗi thiếu/auth/quota/rate-limit/timeout/network/request và không trả provider message ra client.
- Health chỉ biểu thị process sống; readiness biểu thị index/runtime; capability báo cấu hình và
  lần provider thành công/lỗi gần nhất nhưng không gọi API tính phí khi được poll.
- Kết quả gọi thật được ghi tiếp dưới đây sau khi chạy probe. Nếu key vẫn lỗi thì P1 chưa đạt.

#### Kết quả probe có giới hạn

- Chạy ngày 14/09/2026 với cờ xác nhận gọi API, `max_retries=0`, timeout 15 giây.
- Embedding `text-embedding-3-large` thất bại ở HTTP 401, mã nội bộ
  `PROVIDER_AUTH_FAILED`; vì vậy completion không được gọi.
- Không ghi key, prompt hoặc provider message vào log. P1 vẫn bị chặn cho đến khi có key hợp lệ.

### P2 — phần đã triển khai offline

- Scope được suy ra từ ghi danh còn hiệu lực, lớp và học kỳ đang active; nếu sinh viên có nhiều lớp
  cùng môn thì bắt buộc chọn đúng một lớp.
- Whitelist chỉ lấy material version đã published cho đúng lớp và material còn approved. Lesson phải
  published cho chính lớp đó. Citation được kiểm tra lại sau khi provider trả về để chặn nguồn bị thu hồi
  giữa lúc xử lý.
- Không chuyển history do browser cung cấp sang RAG. Câu hỏi trên 8.000 ký tự bị từ chối trước khi tạo
  question/request. Retry RAG mặc định là 0; pilot cũng khóa `RAG_MAX_RETRIES=0`.
- Lỗi provider, citation và persistence đều đưa request ra khỏi `processing`. Request processing cũ hơn
  120 giây được reconciliation thành `REQUEST_INTERRUPTED`; terminal transition có compare-and-set để
  kết quả đến muộn không ghi đè request đã cancel/fail.
- SQLite schema version 7 và PostgreSQL migration `008_rag-provenance.sql` lưu riêng `index_version`,
  `chunk_id`, `chunk_sha256`, `section`. Migration SQLite cũ giữ nguyên row lịch sử; các field mới của
  row cũ để `NULL`, không bịa provenance.
- `/health` là liveness không cần token; readiness/capabilities/answers vẫn cần service token.
  Capability pilot đã khớp các field bắt buộc của OpenAPI, và Pydantic giới hạn ID/history/client như
  JSON Schema.
- Test tại mốc này: 13 test Python đạt; full suite 39 file/206 test đạt; contract suite 9 test đạt;
  4 OpenAPI validate đạt; ESLint và production build đạt.
- Preflight đạt. Stack extractive được start bằng DB pilot riêng, smoke HTTP đạt đủ auth/chat/persistence/
  citation SHA-256/abstain/chặn sai môn, sau đó stop sạch; cổng 3101 và 8787 đã được giải phóng.
- `npm run check` vẫn dừng ở `format:check` vì baseline repository có 185 file chưa theo Prettier.
  Không auto-format toàn repo để tránh làm nhiễu thay đổi của người dùng; toàn bộ file JS/YAML/Markdown
  được chỉnh trong đợt P2 này đã qua Prettier riêng.

Phần P2 còn lại: duyệt proposal contract 1.1, thêm index-ready registry khi triển khai P3, và kiểm tra
scope/index chéo hai repo khi router RAG chính thức được thêm vào MBA_API.
