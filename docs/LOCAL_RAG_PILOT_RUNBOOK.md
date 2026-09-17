# Chatbot local — bản thử kỹ thuật

## Trạng thái và giới hạn

Đã nối trang `/student/chat` của **AI_Trợ_Giảng** với adapter Python chạy local.
Mặc định là **truy xuất BM25 và trả đoạn trích, không có LLM**, không phải câu trả lời AI dựng sẵn.
Nguồn là 4 đoạn tự soạn trong `public/local-rag-sample.json`, chỉ dành cho học phần `sub1`
(Triết học Mác - Lênin). Không phải giáo trình chính thức, chưa được giảng viên thẩm định.

Kiểm tra API ngày 2026-09-14: key sẵn có trong `ChatBot/MBA_API/.env` trả HTTP 401
`invalid_api_key`. Vì vậy **chưa xác minh được nhánh model thật end-to-end**.
Không tự đổi model, không ghi key vào repo/frontend, không chuyển lỗi model thành câu trả lời mẫu.

Đây là **pilot tích hợp contract**, không phải triển khai xong toàn bộ
`LOCAL_RAG_INTEGRATION_PLAN.md`, cũng không phải benchmark luồng LangGraph hiện tại.
Sau khi API key bị từ chối, phạm vi chạy thực tế được thu hẹp sang BM25 offline;
không có bước vector/embedding như phương án ban đầu.

## Chạy ngay

Tại `E:\Project\AI_Trợ_Giảng`:

```powershell
npm run build
npm run local:rag
```

Mở <http://127.0.0.1:3101/student/chat>.

- Sinh viên: `tuananh@ptit.edu.vn` / `Student@123` — tài khoản seed local.
- Chọn **Triết học Mác - Lênin**, chọn lớp đã ghi danh.
- Hỏi: **Phân biệt vật chất và ý thức bằng một ví dụ.**
- Kiểm tra nhãn **Local · truy xuất, chưa dùng LLM** và mở **Xem đoạn trích**.
- Thử câu không khớp: `zzqxwwvvuu zzzqqqppp` → không có nguồn, không bịa câu trả lời.
- `Ctrl+C` trong terminal chạy lệnh để dừng hai dịch vụ.

Lệnh tự tìm checkout `../ChatBot/MBA_API` và Python `.venv/Scripts/python.exe` trên Windows hoặc
`.venv/bin/python` trên Linux.
Nếu khác vị trí, cấu hình `MBA_API_PATH` và `MBA_PYTHON` trước khi chạy.
Python đã kiểm tra: 3.11.9; cần FastAPI, uvicorn, pydantic, các dependency để import
`course_rag.py` (LlamaIndex); nhánh model cần `openai` và `python-dotenv`.
Không cài hay nâng dependency của MBA_API trong lần thử này.

Hai cổng cố định `3101` (web/API) và `8787` (adapter) chỉ bind `127.0.0.1`.
Nếu cổng bận, lệnh báo lỗi; không tự dừng tiến trình khác. Chỉ chạy một pilot tại một thời điểm.
Frontend dùng bản build trong `dist`; sau khi sửa UI cần build lại.

## Dữ liệu được ghi ở đâu?

- `data/local-rag/pilot.sqlite`: database **riêng**, có dữ liệu seed demo và tài liệu mẫu.
- Không đọc/copy/chỉnh sửa `data/ptit-teaching-assistant.sqlite` hiện có.
- Tài liệu mẫu có ID riêng: `mat-local-rag-sample`, `mv-local-rag-sample-v1`.
- Cờ `approved_sources = 1` được seed **chỉ trong pilot DB** để kiểm tra cơ chế whitelist;
  đây không phải sự phê duyệt học thuật của giảng viên.
- Adapter chỉ phục vụ phiên bản mẫu trên; không giả vờ đã index các giáo trình seed khác.
- Mỗi lần smoke/chat sẽ thêm câu hỏi, câu trả lời và citation vào pilot DB; không tự xóa lịch sử.
- Token dịch vụ ngẫu nhiên được truyền qua environment của hai tiến trình, không ghi file.
- Các thay đổi Git/tài liệu đang có của người dùng được giữ nguyên; không commit/push/reset thêm.

## Luồng chạy thực tế

```text
Trình duyệt: /student/chat
  → POST /api/student/chat (Node, :3101)
  → xác thực sinh viên, kiểm tra ghi danh/lớp, lấy whitelist materialVersionId
  → tạo question + rag_request trong pilot.sqlite
  → POST /internal/v1/answers (Python, :8787, Bearer + requestId + idempotency)
  → kiểm tra tenant=ptit, subject=sub1, phiên bản mẫu nằm trong whitelist
  → MBA_API.course_rag.bm25_scores trên 4 đoạn mẫu, tối đa 3 đoạn
  → extractive: trả nguyên đoạn trích, token LLM=0
     hoặc openai: một lần gọi model để tổng hợp JSON và chọn chunkId
  → adapter kiểm tra chunkId, tự lấy quote và SHA-256 từ đoạn gốc
  → Node kiểm tra JSON schema, requestId, whitelist và ánh xạ material/version
  → lưu response + citations + raw provenance/usage/timing
  → UI hiển thị chế độ, cảnh báo mẫu và trích dẫn
```

`GET /api/student/chat/status` cần đăng nhập, lấy trạng thái capability của adapter với
timeout 2 giây. Trạng thái `model` chỉ nghĩa đã cấu hình nhánh model, **không xác nhận key còn hiệu lực**.
`readiness` của adapter chỉ xác nhận runtime/index đã khởi tạo.

Adapter dùng lại **hàm BM25** từ checkout MBA_API, không sửa checkout đó. Không gọi
`main.py`, `load_chat`, `run_course_graph`, resolve/decompose/rewrite/rerank của MBA_API.
Fixture được đọc một lần mỗi lần khởi động. Endpoint sync chạy trong worker pool FastAPI,
không đặt HTTP đồng bộ trực tiếp trong `async def`.

## Các điểm đã xử lý trong phạm vi thử nghiệm

| Điểm xung đột                 | Cách xử lý của pilot                                                                        | Giới hạn/tradeoff                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API web khác contract MBA     | Adapter `/internal/v1/answers` theo contract web; schema được kiểm tra ở Node               | Chưa adapter hóa toàn bộ MBA API                                        |
| Nhiều model call              | Offline: 0; nhánh OpenAI: tối đa 1 call, không retry                                        | Không resolve hội thoại, không tách câu hỏi phức tạp                    |
| Retrieval tuần tự nhiều query | Chỉ một query BM25, bỏ một số từ dừng, tối đa 3 đoạn                                        | Không dense/vector, không RRF/rerank; chất lượng tìm đồng nghĩa kém hơn |
| Khởi tạo lại mỗi request      | Giữ engine/fixture và client trong process                                                  | Đổi fixture cần restart; chưa cache theo phiên bản production           |
| Blocking async                | Handler sync trong thread pool; lock chỉ nhận một lượt xử lý, bận trả 429                   | Pilot không dùng đánh giá tải/concurrency production                    |
| Timeout/retry                 | SDK không retry, nhánh model tối đa khoảng 28s theo deadline; Node timeout 35s, không retry | HTTP timeout không bảo đảm nhà cung cấp dừng inference ngay             |
| Body trả chậm                 | Timeout client Node còn hiệu lực cả lúc đọc JSON body                                       | Chưa đồng bộ toàn bộ timeout của MBA_BE/frontend cũ                     |
| Citation/phạm vi              | Kiểm tra tenant, subject, version; quote/hash lấy từ fixture, không để model tự bịa         | Kiểm tra nguồn không chứng minh suy luận học thuật đúng                 |
| Gửi lặp                       | UI chặn submit khi đang chờ; adapter cache tối đa 128 kết quả theo idempotency              | Cache mất khi restart; không phải exactly-once ở tầng lưu question Node |
| Nhãn UI sai chế độ            | Nhãn lấy từ service; phân biệt extractive/model/demo, hiển thị quote và trạng thái review   | Các trang analytics/lịch sử cũ chưa được đổi toàn bộ thuật ngữ “AI”     |

`isDemo:false` trong kết quả Node hiện có nghĩa đi qua provider thật thay vì mock repository,
**không có nghĩa đã gọi LLM**. Dùng `answerMode` và `sampleData` để phân biệt.
Không fabricate `retrievalScore`, `rerankScore`, số trang hoặc token model.
Timing offline có thể là `0ms` do làm tròn; không dùng con số này để ước lượng latency LLM.

## Bật nhánh model bằng cùng hạ tầng với MBA_API

RAG dùng cùng provider/model với `MBA_API`, nhưng nhận credential riêng qua biến môi trường của process.
Không đọc `ChatBot/MBA_API/.env`, không lấy key từ Langfuse và không ghi secret vào repo hoặc log.
Quản trị viên cấp `MODEL_API_KEY` riêng cho RAG trong cùng provider/project; nếu chưa cấp được thì giữ
`RAG_LOCAL_MODE=extractive`.

Chỉ sau khi được phép dừng/restart đúng pilot do stack này quản lý, chạy:

```powershell
$env:RAG_LOCAL_MODE = 'openai'
$env:MODEL_PROVIDER = 'openai'
$env:MODEL_API_BASE_URL = 'https://api.openai.com/v1'
$env:MODEL_ID = 'gpt-4o-mini'
$env:EMBEDDING_MODEL_ID = 'text-embedding-3-large'
# Nhập MODEL_API_KEY trong terminal/secret environment; không lưu vào file được commit.
npm run local:rag
```

`MODEL_API_BASE_URL` có thể trỏ tới gateway OpenAI-compatible đã được quản trị viên phê duyệt. Endpoint HTTP
chỉ được chấp nhận trên loopback; endpoint từ xa phải dùng HTTPS và không được chứa credential/query/fragment.
Chỉ câu hỏi và các đoạn tài liệu mẫu được chọn đi tới OpenAI; không gửi toàn bộ database.
Mỗi câu có nguồn sẽ phát sinh một call tính phí. Nhánh này vẫn **BM25-only**, không phải dense RAG.
Nếu key lỗi, UI nhận lỗi; không có fallback ngầm. Để quay lại offline ở terminal đó:

```powershell
$env:RAG_LOCAL_MODE = 'extractive'
npm run local:rag
```

Nhánh model dùng JSON output và số token do API trả về theo
[Chat Completions API chính thức](https://developers.openai.com/api/reference/python/resources/chat/subresources/completions/methods/create).
Việc kiểm tra OpenAI Docs giúp giữ usage thật và không coi JSON hợp lệ là citation hợp lệ.

### Dùng Groq cho generation, giữ BM25

Groq là nhánh chat-only của pilot; không gọi embedding và không biến BM25 thành dense retrieval. Cấu hình secret
environment như sau, không commit key:

```text
MODEL_PROVIDER=groq
MODEL_API_BASE_URL=https://api.groq.com/openai/v1
MODEL_API_KEY=<secret>
MODEL_ID=openai/gpt-oss-20b
EMBEDDING_MODEL_ID=none
```

Probe Groq thực hiện đúng một chat completion, không retry và báo `embeddingCalls: 0`. Adapter dùng JSON Object
Mode, một generation cho mỗi câu có nguồn và `reasoning_effort=low`. Nếu cần dense retrieval, phải bổ sung một
embedding provider riêng và tạo index mới; không đổi `none` thành model giả định của Groq.

## Kiểm thử

Khi pilot đang chạy, ở terminal khác:

```powershell
npm run local:rag:smoke
```

Smoke **chỉ cho phép chế độ extractive**, không tự phát sinh chi phí API. Kiểm tra login,
status, POST chat, lưu DB, schema answer, quote/hash, no-source và chặn môn chưa ghi danh.

Các kiểm tra độc lập:

```powershell
& E:\Project\ChatBot\MBA_API\.venv\Scripts\python.exe -B -m unittest discover -s scripts/local-rag -p test_adapter.py -v
npm run test -- server/rag server/contract-tests src/pages/student/ChatPage.test.jsx
npm run lint
npm run build
```

Python tests dùng stub cho nhánh model (usage, citation sai, lỗi provider), **không phải bằng chứng
gọi OpenAI thành công**. UI tests kiểm tra nhãn extractive, chống gửi lặp và hiển thị lỗi/quote.
Phiên này không có browser kết nối với công cụ kiểm tra nên chưa QA trực quan trên browser;
kiểm tra UI bằng component test/build và HTTP end-to-end.

## Những việc chưa được chứng minh

Kết quả kiểm tra trong phiên 2026-09-14:

- Smoke HTTP end-to-end: PASS; trang `/student/chat` trả HTTP 200 và có entry frontend.
- Python adapter: 10/10 tests PASS; model tests dùng stub, không gọi API thật.
- Web/backend: 184/184 tests PASS với `npm run test -- --exclude scripts/load-test.test.js`.
- Full `npm run test` chưa xanh: suite `scripts/load-test.test.js` gặp lỗi Vite/Rolldown
  parse shebang `#!/usr/bin/env node` khi import `scripts/load-test.mjs`. Hai file này không bị sửa.
- `npm run lint`, `npm run build`, `npm run contract:validate` và `git diff --check`: PASS.

- LLM thật: đang vướng API key 401; cần chạy lại end-to-end sau khi thay key.
- Tính đúng/sai học thuật, chất lượng retrieval trên giáo trình thật, OCR và chunking.
- Mongo/Qdrant, LangGraph đầy đủ, multi-turn, streaming, ingest/upload, nhiều tenant/lớp.
- Safety classifier, publication gating production, tải lớn, persistent idempotency.
- Không sửa các vấn đề gốc trong `ChatBot/MBA_API` hay `MBA_BE` bằng pilot này.

Không public hai dịch vụ ra LAN/Internet; chúng dùng tài khoản demo và dữ liệu thử.
