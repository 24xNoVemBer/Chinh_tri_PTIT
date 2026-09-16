# Báo cáo luồng hoạt động và các conflict hiện tại của RAG

Ngày rà soát: 14/09/2026.

## 1. Phạm vi và độ tin cậy

Báo cáo này tách riêng khỏi kế hoạch triển khai, mô tả mã đang có và những điểm xung đột cần giải quyết trước khi nối RAG thật vào web PTIT.

Baseline đã đọc:

| Repo                 | Nhánh / commit                             | Trạng thái liên quan                                               |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `AI_Trợ_Giảng`       | `main` / `9e8167d`                         | Trùng `origin/main`; có thay đổi chưa commit ngoài phạm vi báo cáo |
| `MBA_API`            | `feature/course-rag-langgraph` / `af0bf15` | Sau remote 4 commit; có `.venv/` untracked                         |
| `MBA_BE` và `MBA_UI` | Đọc để đối chiếu đường legacy              | Không thuộc luồng tích hợp chính được đề xuất                      |

Kết luận trong báo cáo gồm hai mức:

- **Đã chứng minh từ code:** call graph, giá trị mặc định, endpoint, query/filter và đường ghi dữ liệu nhìn thấy trực tiếp trong source.
- **Cần runtime test:** độ trễ thực tế, collection/dimension đang tồn tại, dữ liệu Mongo/Qdrant, chất lượng chunk và hành vi khi nhiều request đồng thời.

Chưa gọi model trả phí, chưa chạy ingestion và chưa sửa mã chatbot trong lần lập báo cáo này.

## 2. Các luồng hệ thống

### 2.1. Luồng tích hợp đích cho web PTIT

```text
React/Vite
  → Node backend PTIT
      → xác thực user và quyền lớp/môn
      → tìm material version được phép dùng
      → tạo requestId + idempotencyKey
      → POST MBA_API /internal/v1/answers
          → xác thực service token
          → kiểm tra scope/version
          → retrieve Qdrant
          → gọi model
          → trả terminal answer + citations
      → Node kiểm tra lại citation
      → lưu question/answer/citation vào DB nghiệp vụ
  → trả kết quả cho trình duyệt
```

`/internal/v1/answers`, `/internal/v1/health`, `/internal/v1/readiness` và `/internal/v1/capabilities` hiện là contract mà Node client chờ; MBA_API hiện chưa cung cấp đầy đủ router tương thích này. Vì vậy đường live chưa thể nối trực tiếp dù hai bên đều có logic RAG riêng.

### 2.2. Luồng legacy hiện tại

```text
MBA_UI
  → MBA_BE /auth_mini/mba/*
      → xác thực JWT + ghi log Mongo
      → proxy HTTP đồng bộ
  → MBA_API /chat, /rag hoặc /rag_streaming
      → Mongo + Qdrant + model
```

Luồng này cần được giữ để regression test, nhưng không nên đặt MBA_BE vào giữa Node backend và MBA_API của hệ thống PTIT mới vì sẽ thêm một lớp auth/proxy, timeout và lưu log không cần thiết.

### 2.3. Luồng chat môn học `mode=default`

```text
request
  → đọc SimpleChatStore JSON
  → đọc tối đa 8 exchange lịch sử từ Mongo
  → tạo ChatMemoryBuffer
  → tạo wrapper Qdrant index
  → đọc prompt và tên môn từ Mongo
  → tạo OpenAIAgent
  → LangGraph resolve turn
      ├─ chitchat / identity / conversation / institution
      │    → generate không retrieve
      ├─ syllabus
      │    → catalog hoặc retrieval tập trung
      └─ course
           → decompose query
           → dense retrieval từng query
           → nếu score yếu: rewrite và retrieve lại
           → BM25 local
           → RRF dense + BM25
           → LLM rerank
           → generate
  → ghi SimpleChatStore JSON
  → ghi history Mongo nếu save=true
```

Số external call theo cấu hình mặc định:

| Nhánh                           | LLM completion | Embedding + Qdrant query |
| ------------------------------- | -------------: | -----------------------: |
| Chitchat/identity/conversation  |              2 |                        0 |
| Câu môn học ngắn qua heuristic  |              3 |                        1 |
| Câu môn học thông thường        |              4 |                      1–3 |
| Retrieval đầu yếu và có rewrite |              5 |                      2–6 |

Resolver có thể gọi thêm một lần nếu model trả JSON hỏng. Graph hoặc stream fallback sau khi đã chạy một phần có thể làm tổng call cao hơn bảng.

### 2.4. Luồng streaming

```text
POST /rag_streaming
  → phát event init
  → threadpool: load history + initialize agent
  → phát keepalive trong khi chờ
  → threadpool: resolve + retrieve + chuẩn bị stream
  → event loop đọc synchronous token iterator
  → phát token SSE
  → persist history
  → phát sources + complete
```

Streaming cải thiện cảm giác chờ và giữ proxy sống trong giai đoạn chuẩn bị. Nó chưa async hoàn toàn: việc lấy token tiếp theo từ iterator model và một số thao tác ghi file/PyMongo vẫn chạy đồng bộ trên đường async.

### 2.5. Luồng ingestion đang tồn tại

Repo hiện có nhiều đường ingestion:

```text
File PDF/DOC/DOCX
  → SimpleDirectoryReader
  → SentenceSplitter hoặc TokenTextSplitter
  → có/không SummaryExtractor
  → OpenAIEmbedding với model/dimension khác nhau
  → Qdrant collection có schema khác nhau
```

Các đường chính không thống nhất:

| File/đường                              | Splitter                 | Overlap | Embedding/dimension collection                                 |
| --------------------------------------- | ------------------------ | ------: | -------------------------------------------------------------- |
| `create_node.py::ingest_documents`      | `SentenceSplitter(512)`  |     100 | `OpenAIEmbedding()` không ghi model; collection mặc định 1.536 |
| `create_node.py::create_or_update_node` | `SentenceSplitter(512)`  |     100 | `text-embedding-3-large`; collection mặc định 1.536            |
| `bulk_embed_data.py`                    | `SentenceSplitter(512)`  |     100 | `text-embedding-3-large`; collection 3.072                     |
| `create_qdrant.py`                      | `TokenTextSplitter(512)` |      20 | collection mặc định 1.536                                      |
| `create_chroma.py`                      | `TokenTextSplitter(512)` |      20 | đường lưu trữ cũ khác Qdrant hiện tại                          |

Không thể coi các collection do những đường này tạo ra là tương thích nếu chưa có manifest model, dimension, splitter, chunk size, overlap và phiên bản tài liệu.

## 3. Danh sách conflict

### C01 — Embedding dimension không thống nhất

**Mức độ: Blocker.**

- `create_node.py` và một số utility tạo collection mặc định 1.536 chiều.
- `create_or_update_node`, `bulk_embed_data.py` và query trong `load_chat.py` dùng `text-embedding-3-large` nhưng không chỉ định `dimensions` ở API call.
- OpenAI công bố vector mặc định của `text-embedding-3-large` là 3.072 chiều; 1.536 chỉ đúng khi chủ động dùng model/dimension tương ứng.
- Qdrant yêu cầu vectors trong cùng collection có cùng dimensionality.

Hệ quả: có thể lỗi ngay khi upsert/query, hoặc collection cũ được embed bằng model khác nhưng bị query bằng `text-embedding-3-large`, khiến index không dùng được. Collection nào đã là 3.072 và được tạo bằng đúng model thì không chịu conflict này, nhưng phải kiểm tra runtime thay vì suy từ tên collection.

Xử lý bắt buộc: một manifest versioned cho từng collection; probe một embedding để lấy dimension thật; đối chiếu schema Qdrant trước ingestion/query; dừng sớm khi mismatch. Không tự cắt vector bằng slicing. Nếu chọn 1.536 với `text-embedding-3-large`, phải truyền `dimensions=1536` thống nhất ở cả ingestion và query rồi re-index dữ liệu.

Tham chiếu: [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings), [Qdrant collections](https://qdrant.tech/documentation/manage-data/collections/).

### C02 — Có nhiều pipeline chunking/ingestion cạnh tranh nhau

**Mức độ: Cao.**

`SentenceSplitter` overlap 100, `TokenTextSplitter` overlap 20, có hoặc không `SummaryExtractor`, và nhiều script tạo collection cùng prefix. Cùng một tài liệu có thể sinh node ID, ranh giới chunk, metadata và retrieval score khác nhau tùy endpoint/script được dùng.

`analyze_chunking.py` chỉ hard-code collection `mba_miniBSA1236`, host `localhost:6333`, lấy 10 điểm đầu và ước lượng token bằng `chars / 6`. Nó còn in rằng cấu hình đến từ `bulk_embed_data.py`, nên không chứng minh collection khác được tạo bằng pipeline đó. Utility này phù hợp kiểm tra sơ bộ, không đủ làm nghiệm thu chunking.

Xử lý: chọn một ingestion service duy nhất; các script cũ chuyển thành migration/diagnostic có nhãn rõ; lưu `ingestionVersion`, `embeddingModel`, `dimensions`, `splitter`, `chunkSize`, `overlap`, file hash và material version trong manifest/payload.

### C03 — Contract web và contract MBA_API chưa tương thích

**Mức độ: Blocker tích hợp.**

Node gửi `conversationId`, `messageId`, history, `subjectId`, `classIds`, `lessonId`, `allowedMaterialVersionIds`, policy và giới hạn output. MBA_API hiện nhận chủ yếu `userId`, `source`, `sessionId`, `text`, `mode`, `save`.

Node yêu cầu terminal answer có usage, finish reason và citation chứa `materialId`, `materialVersionId`, `chunkId`, quote, rank, page và `chunkSha256`. `course_rag.node_to_info()` hiện chủ yếu trả node ID, tên/path/type file, text, summary và score.

Không nên map giả các trường còn thiếu. Router adapter phải nhận đúng contract, lọc scope trước retrieval và trả `unknown`/lỗi contract có version cho dữ liệu chưa đo được.

### C04 — `source` kỹ thuật chưa gắn chặt với quyền lớp/môn/material version

**Mức độ: Rất cao về đúng dữ liệu và phân quyền.**

MBA_API tạo tên collection bằng `COLLECTION_PREFIX + source` và retrieval không nhận allow-list material version. Web PTIT lại quyết định quyền theo subject, class, approved material và version. Nếu chỉ đổi `subjectId` thành một chuỗi `source`, RAG có thể tìm trong collection chứa tài liệu ngoài lớp, sai học kỳ hoặc version chưa được duyệt.

Xử lý: Node quyết định allow-list; MBA_API xác thực mapping `subject/term → source/indexVersion`; filter payload theo `allowedMaterialVersionIds` ngay trong Qdrant; sau retrieval kiểm tra lại mọi chunk trước khi đưa vào prompt; Node kiểm tra citation lần cuối trước khi lưu/trả.

### C05 — Học kỳ không hợp lệ âm thầm rơi sang kỳ mặc định/mới nhất

**Mức độ: Rất cao về tính đúng đắn.**

Middleware đọc `X-Academic-Term`, nhưng `normalize_requested_term()` trả `latest_term()` khi header thiếu, sai format hoặc không có trong catalog. Một request ghi sai term có thể truy cập database kỳ khác mà không báo lỗi. Cấu hình còn có alias legacy (`2025_k2`) và school format (`2025_2026_s2`) cùng mapping về database `MBA`, trong khi history/config có logic chọn database riêng.

Xử lý cho router nội bộ: term và index version là trường bắt buộc; canonicalize alias nhưng term không tồn tại phải trả 4xx; response echo canonical term/database/index version; cấm fallback latest trên đường học thuật có scope.

### C06 — Ba nguồn trạng thái hội thoại có thể lệch nhau

**Mức độ: Cao.**

Hiện có `SimpleChatStore` JSON, Mongo `chat_history` và DB nghiệp vụ của Node. Mỗi request legacy đọc toàn bộ file JSON, seed lại từ Mongo, sau đó ghi file và Mongo. Luồng mới còn cần Node lưu question/answer/citation chính thức.

Hệ quả:

- File và Mongo có thể khác nhau sau lỗi giữa hai lần ghi.
- Hai request đồng thời có thể đọc hai snapshot rồi ghi đè toàn bộ file, gây lost update.
- Retry có thể tạo hai model call hoặc hai history record.
- Session/history mà model thấy có thể khác hội thoại người dùng thấy trên web.

Xử lý: Node là nguồn hội thoại chính thức; router nội bộ nhận history giới hạn theo request và không dùng `SimpleChatStore`; trạng thái request/idempotency được lưu trước model call; legacy endpoints giữ hành vi cũ nhưng không chia sẻ memory với đường mới.

### C07 — Prompt Mongo, prompt nền và tool mode có thể mâu thuẫn

**Mức độ: Trung bình–cao.**

Default course mode không cung cấp tool cho agent vì context được inject trước. Tuy nhiên prompt môn trong Mongo có thể chứa chỉ dẫn `file_search`; code xử lý bằng cách xóa toàn bộ dòng chứa chuỗi này rồi nối `COURSE_ASSISTANT_BASE_PROMPT`. Việc xóa theo dòng có thể loại luôn một quy tắc nghiệp vụ hữu ích. Các mode Ami lại thật sự dùng tool và có persona riêng. Các module legacy như `openaa.py` còn hard-code danh tính/miền MBA khác với trợ giảng PTIT.

Hệ quả là identity, độ dài, yêu cầu dùng nguồn và cách từ chối có thể thay đổi theo endpoint/mode hoặc dữ liệu prompt Mongo.

Xử lý: prompt contract có version; tách identity, grounding, style và policy thành trường riêng; không chỉnh prompt bằng regex dòng; test snapshot cho default/Ami/legacy; router PTIT không gọi module prompt tổng hợp MBA cũ.

### C08 — Orchestration tạo quá nhiều call và retrieval chạy tuần tự

**Mức độ: Rất cao về latency/cost.**

Default course path có thể chạy resolve → decompose → 1–3 retrieve → rewrite → 1–3 retrieve → rerank → generate. Vòng `retriever.retrieve(query)` chạy tuần tự, nên latency gần bằng tổng thời gian embedding và Qdrant của từng query. Resolver còn retry một lần khi JSON không hợp lệ.

Xử lý theo thứ tự: đo từng stage; fast path một query; chỉ resolve khi cần history/follow-up; chỉ decompose câu nhiều ý; rewrite tối đa một lần; rerank có điều kiện; batch/parallel retrieval có semaphore. Mọi thay đổi giảm call phải A/B với bộ câu hỏi chuẩn vì có trade-off recall.

### C09 — Blocking I/O nằm trong `async def`

**Mức độ: Rất cao khi có tải đồng thời.**

- MBA_API `/chat`: file I/O, PyMongo, embedding/Qdrant, LLM và persist chạy đồng bộ trực tiếp.
- MBA_API streaming: init/retrieval đã ở executor, nhưng synchronous token iterator và một số lần ghi vẫn chạy trên event loop.
- MBA_BE `/rag`: `requests.get(..., timeout=60)` trong async route.
- MBA_BE streaming: sync Mongo log + `requests.post(..., timeout=(10, None))`; read timeout không giới hạn.

Blocking chủ yếu làm giảm throughput và tăng queue latency, không phải nguyên nhân duy nhất của latency một request đơn. Dùng threadpool không giới hạn cũng có thể làm cạn thread hoặc tăng đồng thời tới provider.

Xử lý: async client nơi khả thi; bridge sync bằng bounded threadpool; semaphore/hàng đợi; deadline toàn request; disconnect/cancel; metric queue wait và active slots. [FastAPI concurrency](https://fastapi.tiangolo.com/async/)

### C10 — Timeout và retry không có một ngân sách chung

**Mức độ: Cao.**

Node mặc định timeout 30 giây và retry 2 lần. MBA_BE non-stream cắt ở 60 giây. LLM wrapper có timeout/retry riêng. Streaming legacy cho read timeout vô hạn. Một request phía ngoài có thể timeout trong khi model phía trong vẫn chạy; retry sau đó tạo thêm pipeline và chi phí.

Xử lý: một deadline truyền xuyên các lớp; retry chỉ cho lỗi được phân loại và dùng cùng idempotency key; mặc định không retry model call khi chưa có ledger; stream có idle timeout và max duration; trạng thái `unknown` khi không xác định provider đã xử lý hay chưa.

### C11 — Fallback có thể lặp toàn bộ pipeline

**Mức độ: Cao.**

Khi LangGraph lỗi, `chat_interface*` rơi xuống legacy retrieval/generation. Khi frontend legacy không nhận token đầu, nó gọi endpoint non-stream. Request đầu không chắc đã dừng ở provider. Vì vậy một thao tác người dùng có thể chạy retrieval/model hai lần và lưu history trùng.

Xử lý: fallback chỉ đổi cách đọc/kết nối nếu có thể tiếp tục cùng server-side job; client tra trạng thái theo request ID thay vì tạo job mới; graph failure sau model call phải được ghi stage/attempt và không tự generate lại nếu chưa xác định kết quả cũ.

### C12 — Citation chưa đủ provenance để kiểm chứng

**Mức độ: Blocker nghiệm thu học thuật.**

RAG response chưa có material/version/hash/page bắt buộc theo contract web. Tên file và đoạn text không đủ chứng minh nguồn đúng phiên bản. Với PDF, page hiển thị còn phải phân biệt PDF page index và số trang in trong tài liệu.

Xử lý: metadata được tạo từ ingestion, không suy ra sau generation; mỗi chunk có stable ID và SHA-256; material/version map được xác thực; citation quote phải là substring của chunk; Node reject citation ngoài allow-list.

### C13 — Version source local và remote đang lệch

**Mức độ: Cao về tích hợp thay đổi.**

MBA_API local `af0bf15` đang sau remote 4 commit, trong đó remote có thay đổi Langfuse tracing và hai commit thông điệp không mô tả rõ (`a`). Nếu tối ưu trên snapshot local rồi mới kéo remote, conflict hoặc hành vi đo có thể thay đổi. Ngược lại, merge tracing trước khi có baseline có thể làm khó phân biệt overhead mới với latency cũ.

Xử lý: review diff 4 commit, chốt baseline, tách commit instrumentation khỏi commit tối ưu; không merge mù; ghi SHA vào mọi báo cáo benchmark.

### C14 — Docker/image và đường dẫn dữ liệu chưa tái lập

**Mức độ: Trung bình–cao về vận hành.**

Compose dùng `qdrant/qdrant:latest`; data root có nhiều candidate layout legacy/term/current; một số script hard-code localhost, port 6333 và collection cụ thể. Cùng source có thể đọc metadata/file ở thư mục khác với dữ liệu đã ingest.

Xử lý: pin image tag/digest; profile local riêng; một canonical data root; manifest chứa absolute resolved source path và file hash; diagnostic nhận host/port/collection từ config thay vì hard-code.

## 4. Ưu tiên xử lý

| Ưu tiên | Conflict           | Điều kiện hoàn thành                                                                            |
| ------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| P0      | C01, C02           | Một ingestion pipeline; model/dimension/chunking manifest thống nhất; probe và schema check đạt |
| P0      | C03, C04, C05, C12 | Router nội bộ đúng contract; scope/term fail closed; citation đủ provenance                     |
| P1      | C06, C10, C11      | Node giữ history/job ledger; retry không nhân bản model call trong phạm vi đã kiểm thử          |
| P1      | C08, C09           | Có stage timing, bounded concurrency và benchmark P50/P95                                       |
| P2      | C07                | Prompt contract/version và test theo mode                                                       |
| P2      | C13, C14           | Baseline Git và runtime có thể tái lập                                                          |

## 5. Bộ kiểm tra tối thiểu trước khi tuyên bố RAG hoạt động

1. Probe embedding và assert dimension bằng schema Qdrant.
2. Nạp một tài liệu hai lần; lần hai không tạo chunk/vector trùng.
3. Kiểm tra payload của từng chunk có material/version/hash/page/index version.
4. Query cùng một câu qua retrieval trực tiếp và router nội bộ; kết quả không ra ngoài allow-list.
5. Gửi term sai, source sai, material version sai; tất cả phải fail closed.
6. Chạy câu chào, câu môn ngắn, câu nhiều ý, follow-up, retrieval yếu và ngoài phạm vi; ghi số model/embedding call thật.
7. Ngắt client giữa stream; job có trạng thái rõ và slot được giải phóng.
8. Retry cùng idempotency key; không có model call, question hoặc response trùng.
9. Chạy đồng thời 1, 3 và 5 request; đo queue wait, TTFT, total latency, lỗi và token.
10. Restart Mongo/Qdrant/MBA_API; readiness phản ánh dependency và không làm mất mapping/index manifest.

## 6. Kết luận

RAG hiện có đủ thành phần để làm nền thử nghiệm, nhưng chưa đủ điều kiện nối live an toàn. Blocker lớn nhất không chỉ là tốc độ: schema embedding không thống nhất, nhiều ingestion pipeline, contract/scope giữa web và MBA_API chưa khớp, học kỳ có fallback âm thầm và citation thiếu provenance.

Thứ tự đúng là khóa ingestion/index schema và contract dữ liệu trước; sau đó mới tối ưu số model call, retrieval song song và async. Nếu tối ưu latency trước khi giải quyết C01–C05/C12, hệ thống có thể trả lời nhanh hơn nhưng từ sai collection, sai phiên bản hoặc nguồn không kiểm chứng được.
