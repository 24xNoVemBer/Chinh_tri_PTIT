# Kế hoạch tích hợp RAG chạy local — PTIT Chính Trị

Bổ sung ngày 09/09/2026: checklist thực hiện, trách nhiệm chuẩn bị dữ liệu và biên bản nghiệm thu tại mục 12–15. Các kết quả kiểm kê ở mục 1 là ảnh chụp trạng thái ngày 08/09, cần xác minh lại khi bắt đầu L0.

Mục tiêu: chạy web, backend nghiệp vụ, API RAG và database trên máy phát triển; sinh viên hỏi theo môn/lớp, nhận câu trả lời có nguồn, xem lại hội thoại và nhận phản hồi từ giảng viên.

Phạm vi local trong bản đề xuất này: model sinh câu trả lời và embedding vẫn gọi API theo mã ChatBot hiện có. Vì vậy vẫn cần Internet và khóa model hoạt động. Chạy cả model offline là phương án khác, được ghi riêng ở cuối tài liệu; không mặc định đưa vào phạm vi này khi chưa chốt.

## 1. Những gì đã kiểm tra trên máy

| Hạng mục                        | Kết quả thực tế                                                                                  | Ý nghĩa cho kế hoạch                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Repo web                        | `E:\Project\AI_Trợ_Giảng`, nhánh `main`, commit `b4d93d4`, worktree sạch khi kiểm tra            | Local đang sau `origin/main` 2 commit theo thông tin Git đã lưu; cần fetch và đối chiếu lại ở L0 |
| Mã chatbot                      | `E:\Project\ChatBot\MBA_API`, `MBA_BE`, `MBA_UI`                                                 | Tích hợp engine trong `MBA_API`; nghiệp vụ lớp/tài khoản tiếp tục do backend web quản lý         |
| Node                            | 24.14.1                                                                                          | Đã có runtime cho web/backend                                                                    |
| Python                          | 3.11.9; `MBA_API/.venv` đã tồn tại                                                               | Có thể kiểm tra và tái sử dụng môi trường Python                                                 |
| Python dependencies             | `pip check` trong `.venv`: không phát hiện dependency hỏng                                       | Chưa chứng minh import, khởi động hoặc model call chạy được                                      |
| PostgreSQL                      | PostgreSQL 17 đã cài, service `postgresql-x64-17` đang chạy                                      | Ưu tiên tạo database local riêng trên instance này                                               |
| Docker                          | CLI 29.7.2 đã cài; Docker Desktop Linux engine chưa kết nối được                                 | Cần bật engine trước khi tạo MongoDB/Qdrant                                                      |
| CPU / RAM                       | Intel Core i9-14900HX; khoảng 15,7 GiB RAM                                                       | Phù hợp để thử một môn với model qua API; phải đo mức dùng RAM khi chạy thật                     |
| GPU                             | RTX 5060 Laptop GPU và Intel UHD Graphics                                                        | Không cần dùng GPU cho phương án model/embedding qua API                                         |
| Ổ E                             | Khoảng 125,1 GiB còn trống tại thời điểm kiểm tra                                                | Dự trù 15–25 GiB cho môi trường, image, dữ liệu và backup nhỏ; đo lại khi nạp thêm               |
| `MBA_API/.env`                  | Có giá trị cho `OPENAI_API_KEY`, `OPENAI_MODEL`, `MONGO_URI`, `QDRANT_HOST`, đường dẫn dữ liệu   | Không cần hỏi lại khóa trước khi kiểm tra cấu hình đang có; chưa xác minh khóa hợp lệ/quota      |
| Địa chỉ DB trong `.env` chatbot | MongoDB và Qdrant trỏ loopback/local                                                             | Không suy đoán dữ liệu đã được lấy từ server PTIT                                                |
| Giáo trình trong source         | Không tìm thấy PDF, DOC, DOCX, PPTX ngoài thư mục dependency/Git; chỉ thấy vài TXT phục vụ dự án | Chưa có bộ giáo trình đã xác nhận để nạp thử                                                     |
| Đường dẫn dữ liệu               | `DATA_ROOT`, `DATA_MBA_LARGE` hiện không tồn tại khi đối chiếu từ thư mục API                    | Cần chuẩn bị dữ liệu local hoặc xác định bản sao đang nằm nơi khác                               |

Không có thư mục vector trong source không có nghĩa Docker volume chắc chắn rỗng. Việc kiểm tra volume/container hiện hữu chỉ làm được sau khi Docker engine hoạt động.

## 2. Kiến trúc đề xuất và ranh giới dữ liệu

Luồng chính: **Trình duyệt → backend PTIT → API nội bộ của MBA_API → truy xuất Qdrant / gọi model → backend lưu kết quả → trình duyệt.**

| Thành phần          | Chạy ở đâu                              | Cổng local dự kiến                       | Trách nhiệm                                                       |
| ------------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| React/Vite          | Windows, repo web                       | `5173`                                   | Giao diện sinh viên, giảng viên, admin                            |
| Backend Node        | Windows, repo web                       | `3001`                                   | Đăng nhập, kiểm tra lớp/môn, hội thoại, trích dẫn, kiểm duyệt     |
| MBA_API             | Python `.venv` trên Windows             | `4558`                                   | Truy xuất tài liệu và sinh câu trả lời                            |
| PostgreSQL 17       | Service Windows đang có                 | Kiểm tra thực tế; thường `5432`          | Database nghiệp vụ local riêng: đề xuất `ptit_politics_rag_local` |
| MongoDB             | Docker                                  | Đề xuất host `27018` → container `27017` | Cấu hình môn/prompt, học kỳ và trạng thái ingestion của RAG       |
| Qdrant              | Docker                                  | Đề xuất host `6335` → container `6333`   | Vector và metadata của tài liệu thử nghiệm                        |
| Model/embedding API | Dịch vụ bên ngoài theo cấu hình hiện có | HTTPS                                    | Sinh câu trả lời và embedding                                     |

Các cổng MongoDB/Qdrant khác mặc định để dễ phân biệt stack thử nghiệm và dịch vụ có sẵn. L1 phải kiểm tra xung đột rồi mới chốt. Chỉ publish cổng database lên loopback. Python chạy trên host nên dùng cổng host; cấu hình bên trong container sử dụng tên service/cổng container.

### 2.1. Lựa chọn kỹ thuật chính

1. Dùng PostgreSQL local riêng cho thử nghiệm; không mặc định app đang dùng PostgreSQL chỉ vì máy đã cài. Hiện `.env.example` của web vẫn mặc định SQLite.
2. MongoDB và Qdrant có volume riêng, đặt tên theo stack `ptit-rag-local`.
3. Dùng Python `.venv` hiện có sau khi xác minh dependency; không khởi động thêm `MBA_UI` hoặc `MBA_BE` cho luồng chính này.
4. Bổ sung router tương thích trong `MBA_API`, phục vụ contract `/internal/v1/...` mà backend PTIT đang chờ. Router gọi trực tiếp engine chung; tránh gọi HTTP vòng lại chính API.
5. Backend nghiệp vụ là nơi lưu hội thoại chính thức. API nội bộ RAG nhận lịch sử đã giới hạn từ backend và xử lý từng lượt; không dùng file JSON chung làm nguồn lịch sử cho luồng mới.
6. Giữ các endpoint MBA hiện hữu để tránh ảnh hưởng các ứng dụng đang dùng chúng. Mọi chỉnh sửa cần tách commit và chạy lại smoke test của luồng cũ.
7. Khởi động bằng script local có cấu hình riêng và log đã che bí mật. Các script nêu trong plan là đầu ra cần xây dựng, chưa phải lệnh đã có.

### 2.2. Phân bổ tài nguyên ban đầu

Đây là ngân sách thử nghiệm, không phải benchmark hoặc yêu cầu tối thiểu đã đo:

| Nhóm                        | Ngân sách dự kiến                                             |
| --------------------------- | ------------------------------------------------------------- |
| Docker cho MongoDB + Qdrant | Bắt đầu khoảng 3–4 GiB tổng giới hạn; đo riêng từng container |
| Python RAG                  | Khoảng 1–3 GiB tùy tài liệu, chunk và mức song song           |
| Node/Vite/PostgreSQL        | Khoảng 1–2 GiB tổng khi thử nhỏ                               |
| Windows, IDE, trình duyệt   | Giữ phần RAM còn lại; tránh chạy đồng thời nhiều tác vụ nặng  |

Chỉ nạp một tài liệu mỗi lần và một môn ở giai đoạn đầu. Nếu tổng RAM gần cạn hoặc có swap kéo dài, giảm batch ingestion và số request đồng thời trước khi tăng tải.

## 3. Các khoảng trống phải xử lý

| Mã  | Hiện trạng có bằng chứng từ code                                                                                                                    | Hướng xử lý                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| G01 | Client web gọi `/internal/v1/answers`; MBA_API có `/chat` và `/rag_streaming/`                                                                      | Thêm router tương thích và health/readiness/capabilities                                     |
| G02 | Request MBA sử dụng `source`, `userId`, `sessionId`; web sử dụng subject/class/material-version scope                                               | Tạo ánh xạ môn + học kỳ → nguồn, backend quyết định scope                                    |
| G03 | `node_to_info` trả ID chunk, tên file, text, score; chưa trả đủ material/version/hash; đường đi này không trả số trang                              | Chuẩn hóa metadata từ ingestion đến retrieval, giữ provenance thật                           |
| G04 | Tạo collection trong `create_node.py` mặc định `vector_size=1536`; embedding dùng `text-embedding-3-large` nhưng chưa chỉ định dimensions tương ứng | Kiểm tra đầu ra embedding và schema collection; thống nhất model/dimension trước lần nạp đầu |
| G05 | `/upload` trả `uploaded` rồi xử lý vector trong daemon thread                                                                                       | Có trạng thái ingestion bền vững; chỉ cho chat với index `ready`                             |
| G06 | ChatPage và API repository chỉ gửi content/subject/class; chưa gửi conversation/message ID                                                          | Bổ sung hội thoại lưu DB, quyền sở hữu, message ID và chống gửi lặp                          |
| G07 | Mã RAG còn đọc/ghi một `SimpleChatStore` JSON dùng chung                                                                                            | Luồng nội bộ mới nhận history từ backend và dùng memory riêng mỗi request                    |
| G08 | `/chat` gọi xử lý đồng bộ trong `async def`; streaming còn cần rà việc đọc token đồng bộ                                                            | Tách blocking work khỏi event loop, giới hạn song song và hàng đợi                           |
| G09 | Chưa thấy service-auth và allow-list phiên bản tài liệu ở endpoint chat MBA hiện tại                                                                | Router nội bộ có Bearer token và lọc tài liệu trước retrieval; kiểm tra kết quả lần nữa      |
| G10 | Môn/học kỳ không hợp lệ ở một số đường đi có thể rơi về học kỳ mới nhất                                                                             | Luồng tích hợp mới phải báo lỗi rõ, không tự chuyển sang học kỳ khác                         |
| G11 | Contract answer yêu cầu nhiều chỉ số/version mà phản hồi MBA hiện chưa có                                                                           | Ghi số đo thực; hỗ trợ giá trị chưa biết bằng contract có version, không điền số giả         |
| G12 | UI luôn ghi “demo”, kể cả khi backend đã có live path                                                                                               | Hiển thị mode theo capability từ backend; tách `isDemo` và trạng thái kiểm duyệt             |
| G13 | Live repository ghi question trước model call, chưa có idempotency nghiệp vụ đầy đủ; xác minh citation ở bước sau cũng có thể lỗi                   | Lưu trạng thái terminal cho mọi lỗi, request trùng trả lại job cũ, không nhân bản câu hỏi    |

Qdrant yêu cầu vector trong cùng cấu hình collection có dimension phù hợp. G04 phải được kiểm chứng bằng một embedding mẫu trước khi nạp cả giáo trình. Xem [tài liệu collections của Qdrant](https://qdrant.tech/documentation/manage-data/collections/).

Với FastAPI, gọi hàm đồng bộ trực tiếp bên trong `async def` không tự đưa hàm đó sang threadpool. G08 cần được xử lý và đo lại, không chỉ tăng số worker. Xem [FastAPI — concurrency](https://fastapi.tiangolo.com/async/#other-utility-functions).

### 3.1. Rà soát chi tiết đường chạy và điểm gây chậm của MBA_API

Phần này là kết quả đọc mã ngày 10/09/2026 trên snapshot local MBA_API `af0bf15` của nhánh `feature/course-rag-langgraph`; nhánh local đang sau remote 4 commit. Đây là phân tích call graph tĩnh, chưa phải số đo runtime vì MongoDB, Qdrant và bộ giáo trình local chưa sẵn sàng để benchmark. Các số lượt bên dưới áp dụng cho `mode=default`, `COURSE_USE_LANGGRAPH=true`, `COURSE_USE_TURN_RESOLVE=true` và các cờ RAG mặc định; các mode Ami vẫn đi qua nhánh tool/agent cũ.

#### 3.1.1. Mục 1 — luồng model call thực tế

Hai endpoint `/chat` và `/rag_streaming/` khác nhau ở cách trả kết quả nhưng cùng dùng đường xử lý môn học trong `load_chat.py`:

```text
HTTP request
  → load_chat_store()
  → seed lịch sử từ Mongo
  → initialize_chatbot()
  → chat_interface() hoặc chat_interface_streaming()
  → resolve_turn()                                  [LLM #1]
  → route theo intent
      ├─ chitchat/identity/conversation/institution
      │    └─ generate hoặc stream_generate         [LLM #2]
      ├─ syllabus
      │    └─ catalog hoặc retrieve → generate
      └─ course
           → decompose_to_sub_queries() nếu không qua fast heuristic
                                                       [LLM #2]
           → retrieve từng sub-query                  [embedding + Qdrant]
           → nếu top score < 0,35:
                rewrite_search_queries()              [LLM kế tiếp]
                → retrieve từng query rewrite         [embedding + Qdrant]
           → BM25 + RRF                               [CPU local]
           → llm_rerank() nếu có candidates           [LLM kế tiếp]
           → generate hoặc stream_generate            [LLM cuối]
  → persist SimpleChatStore JSON
  → lưu câu hỏi/câu trả lời vào Mongo
```

Số lượt bình thường theo nhánh:

| Loại câu                                                                       |     LLM completion | Embedding + Qdrant | Ghi chú                                                   |
| ------------------------------------------------------------------------------ | -----------------: | -----------------: | --------------------------------------------------------- |
| Chào hỏi, hỏi danh tính, hội thoại không cần tài liệu                          |                  2 |                  0 | Resolver vẫn chạy trước khi route sang generate           |
| Câu môn học ngắn, tối đa 6 từ, không có `?` và không có tín hiệu nhiều ý       |                  3 |                  1 | Heuristic trả thẳng một query nên không gọi LLM decompose |
| Câu môn học thông thường có `?`, dài hơn 6 từ hoặc có tín hiệu so sánh/nhiều ý |                  4 |                1–3 | Resolve + decompose + rerank + generate                   |
| Câu môn học có lượt retrieval đầu yếu                                          |                  5 |                2–6 | Thêm một LLM rewrite và 1–3 lượt retrieve viết lại        |
| Resolver trả JSON hỏng                                                         | cộng thêm tối đa 1 |          không đổi | Resolver gọi lại model một lần để sửa JSON                |

Con số 4–5 trong bảng vấn đề là số **LLM completion** của nhánh môn học thường/yếu, chưa bao gồm 1–6 lời gọi embedding dùng cho retrieval. Nếu graph lỗi sau khi đã thực hiện một số bước, `chat_interface*` rơi xuống legacy path và có thể retrieve/generate lại; tổng số call lúc đó cao hơn bảng. Nếu client stream lỗi rồi tự gọi endpoint non-stream, cả request có thể bị lặp thêm một lần nữa.

Điểm cần đo riêng trong L8: `resolveMs`, `decomposeMs`, số `embeddingCalls`, `denseRetrieveMs[]`, `rewriteMs`, `rerankMs`, `generationTtftMs`, `generationTotalMs`, token của từng LLM call và tổng chi phí của cả request. Chỉ đo token của câu trả lời cuối sẽ bỏ sót chi phí resolver/decompose/rewrite/rerank.

#### 3.1.2. Mục 2 — retrieval đang tuần tự ở đâu

`course_rag.dense_multi_query_retrieve()` tạo một retriever rồi gọi `retriever.retrieve(query)` bên trong vòng `for` của hàm `collect()`. Vì không có `gather`, task group hoặc batch request, query sau chỉ bắt đầu khi query trước hoàn tất.

```text
decompose LLM
  → query 1: embedding → Qdrant
  → query 2: embedding → Qdrant
  → query 3: embedding → Qdrant
  → tính first_top_score
  → nếu yếu: rewrite LLM
       → rewrite 1: embedding → Qdrant
       → rewrite 2: embedding → Qdrant
       → rewrite 3: embedding → Qdrant
  → deduplicate theo node id
  → lấy tối đa 24 candidates
  → BM25 trên candidate text
  → RRF dense + BM25
  → LLM rerank tối đa 12 candidates
  → trả tối đa 8 chunks
```

Độ trễ của đoạn này gần với tổng các bước, không phải bước chậm nhất:

```text
T_retrieval = T_decompose
            + Σ(T_embedding_i + T_qdrant_i)
            + [T_rewrite + Σ(T_embedding_rewrite_i + T_qdrant_rewrite_i)]
            + T_BM25/RRF
            + T_rerank
```

BM25 và RRF chỉ chạy local trên candidate pool nhỏ nên dự kiến không phải phần chính; cần đo để xác nhận. Hướng tối ưu ít thay đổi chất lượng là batch/parallel retrieval có giới hạn. Trade-off là tăng burst tới embedding provider và Qdrant, dễ chạm rate limit hơn; vì vậy phải có semaphore và fallback tuần tự. Hướng giảm call là giới hạn sub-query/rewrite, nhưng phải A/B vì có thể giảm độ phủ ở câu hỏi nhiều ý hoặc dùng từ khác giáo trình.

#### 3.1.3. Mục 3 — phạm vi blocking trong async

**MBA_API non-stream:** `/chat` là `async def` nhưng gọi trực tiếp các hàm đồng bộ: đọc file chat-store, PyMongo, dựng agent, embedding/Qdrant, LLM và ghi file/Mongo. Không có `await` hay threadpool bao quanh toàn pipeline, nên event loop của worker bị giữ cho đến khi request hoàn tất. Điều này chủ yếu làm tăng thời gian xếp hàng và giảm throughput khi nhiều request cùng đến; chuyển sang threadpool/async client không làm bản thân model sinh token nhanh hơn.

**MBA_API streaming:** phần init và pre-retrieve đã được đưa vào `run_in_executor`, nên tốt hơn non-stream. Tuy nhiên vòng `for chunk in process_streaming_response(...)` vẫn gọi `next()` trên iterator model đồng bộ ngay trong async generator. `await asyncio.sleep(0)` chỉ nhường loop sau khi token đã lấy được; nó không làm khoảng chờ mạng bên trong `next()` trở thành async. Callback hoàn tất còn persist file JSON, và `_do_save()` gọi PyMongo đồng bộ trong đường async.

**MBA_BE legacy proxy:** `/rag/` là `async def` nhưng gọi `requests.get(..., timeout=60)` trực tiếp. `/rag_streaming/` ghi log Mongo đồng bộ và gọi `requests.post(..., stream=True, timeout=(10, None))` trước khi trả `StreamingResponse`; handshake upstream vẫn có thể giữ event loop, còn read timeout `None` cho phép stream treo vô hạn. Iterator `iter_content()` là iterator đồng bộ được giao cho `StreamingResponse`, nhưng điều đó không khắc phục các thao tác blocking đã xảy ra trước khi response được trả.

MBA_BE không nằm trên luồng chính được đề xuất cho web PTIT (`browser → Node backend → MBA_API`), nên không cần sửa MBA_BE để đạt M1/M2. Vấn đề ở MBA_BE vẫn phải giữ trong regression scope nếu muốn tối ưu hoặc duy trì MBA_UI cũ.

Giải pháp cho router nội bộ mới: endpoint async chỉ làm validation/auth nhẹ; chạy pipeline blocking trong threadpool có capacity limiter hoặc chuyển từng client sang async; dùng semaphore/hàng đợi để chặn quá tải; đọc token bằng async bridge; đặt deadline cho toàn request; khi client disconnect thì hủy phần nội bộ có thể hủy và giải phóng slot. Tăng số Uvicorn worker chỉ phân tán blocking sang nhiều process, không thay thế giới hạn song song và cancellation.

#### 3.1.4. Mục 5 — phần nào thật sự khởi tạo lại mỗi request

Nhận định ban đầu “đọc lịch sử, truy vấn Mongo, dựng index và agent lại” đúng một phần và cần hiểu theo bảng sau:

| Thành phần                                                                  | Mỗi request?                 | I/O ngoài tiến trình?     | Chi tiết                                                                                                                   |
| --------------------------------------------------------------------------- | ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `SimpleChatStore.from_persist_path`                                         | Có                           | Đọc file                  | Parse toàn bộ file hội thoại hiện có, không chỉ key của user hiện tại                                                      |
| Seed history                                                                | Có                           | Mongo                     | Query theo `session_id + user_id + source` hoặc `user_id + source`, rồi đưa tối đa 8 exchanges vào memory                  |
| `ChatMemoryBuffer`                                                          | Có                           | Không                     | Tạo memory cho agent với `token_limit=3000`                                                                                |
| `QdrantVectorStore`, `StorageContext`, `VectorStoreIndex.from_vector_store` | Có                           | Chủ yếu tạo wrapper local | Không có bằng chứng rằng toàn bộ vectors được tải về mỗi request; network chính xảy ra lúc retrieve                        |
| Prompt môn                                                                  | Có                           | Mongo                     | `get_prompt_from_source(source)` gọi `find_one`; khi metadata thiếu còn có thể gọi thêm `get_chatbot_subject_name(source)` |
| `OpenAIAgent.from_tools`                                                    | Có                           | Chủ yếu tạo object local  | Chưa phải model call; chi phí cần đo thay vì mặc định coi là nút thắt chính                                                |
| LangGraph compile                                                           | Không, trừ request đầu/reset | Không                     | `_COURSE_GRAPH` được cache toàn cục sau `build_course_graph()`                                                             |
| Qdrant client, embedding model và `Settings.llm`                            | Không theo request           | Không ở bước tạo          | Được tạo ở mức module; chỉ phát sinh network khi gọi retrieve/model                                                        |
| Persist chat-store                                                          | Có sau câu trả lời           | Ghi file                  | Ghi lại store JSON; có thể xảy ra thêm khi cần xóa memory cũ                                                               |
| Lưu lịch sử chính thức                                                      | Có nếu `save=true`           | Mongo                     | `insert_one` sau khi có kết quả; streaming cố lưu trước event `complete`                                                   |

Rủi ro lớn hơn thời gian tạo object là file `SimpleChatStore` dùng chung: nhiều request có thể đọc các snapshot khác nhau rồi lần lượt ghi đè toàn bộ file, dẫn tới tranh chấp/lost update; thời gian parse/ghi cũng tăng theo kích thước file. Vì luồng tích hợp mới đã chọn backend PTIT làm nguồn lịch sử chính thức, router `/internal/v1/answers` không nên đọc/ghi file này. Nó nhận history đã giới hạn trong request, tạo state riêng cho lượt xử lý, cache wrapper/index và prompt theo `source + indexVersion`, rồi invalidation cache khi prompt/index đổi.

Tối ưu mục này dự kiến giúp độ ổn định và giảm overhead, nhưng không nên kỳ vọng nó loại bỏ phần lớn latency khi các LLM/retrieval call nối tiếp vẫn còn. Cần benchmark `historyReadMs`, `promptLookupMs`, `indexWrapperMs`, `agentInitMs`, `chatStorePersistMs` trước khi quyết định cache sâu hoặc thay thư viện.

## 4. Đầu vào cần có và cách xác minh

| Đầu vào                            | Đã có / cần làm                                                                          | Chặn phase nào                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| Khóa model và model name           | Có giá trị trong `.env`; kiểm tra bằng một request nhỏ và chỉ báo kết quả, không in khóa | L2 sinh/embedding thật               |
| Quyền vào PostgreSQL local         | Service đang chạy; chưa kiểm tra credential tạo DB/role riêng                            | L1                                   |
| Docker Desktop engine              | Đã cài; cần khởi động và xác nhận dùng được                                              | L1                                   |
| Giáo trình thử nghiệm              | Chưa tìm thấy trong source; cần đường dẫn file thật hoặc gói bàn giao dữ liệu RAG        | L3                                   |
| Môn + học kỳ thử nghiệm            | Đề xuất Triết học Mác–Lênin, một học kỳ được ghi rõ trong cả hai hệ thống                | L3                                   |
| Metadata tài liệu                  | Tên, tác giả/đơn vị, bản/năm, môn, quyền hiển thị, hash file                             | L3                                   |
| Câu hỏi có đáp án đối chiếu        | 10 câu học thuật từ giáo trình + 5 câu kiểm tra ngữ cảnh/ngoài phạm vi                   | L3 và L8                             |
| Snapshot nếu đã có index trên PTIT | Tùy chọn: Mongo config, Qdrant snapshot, file gốc, model/dimension/version dùng để index | L3 nếu chọn phục hồi thay vì nạp mới |

Nếu có snapshot, khôi phục vào volume/database mới và xác minh metadata trước khi dùng. Snapshot Qdrant đơn lẻ không thay thế file gốc và mapping nguồn. Nếu không có giáo trình, có thể dùng tài liệu thử nghiệm do dự án tạo và ghi rõ là fixture, nhưng kết quả đó chỉ nghiệm thu kỹ thuật, chưa nghiệm thu kiến thức môn học.

Không cần gửi lại mật khẩu/khóa trong hội thoại. Khi triển khai, dùng cấu hình bí mật local đã có hoặc nhập vào file môi trường được ignore.

## 5. Các mốc triển khai

| Mốc | Phase | Kết quả để review                                                       |
| --- | ----- | ----------------------------------------------------------------------- |
| M0  | L0–L1 | Hạ tầng local chạy, web đăng nhập được, dữ liệu cũ được bảo toàn        |
| M1  | L2–L3 | RAG trả lời một môn từ giáo trình local, nguồn đã ánh xạ được           |
| M2  | L4–L6 | Hỏi đáp thật trong web, lưu hội thoại, phân lớp và kiểm duyệt hoạt động |
| M3  | L7–L8 | Streaming, phục hồi lỗi, kiểm tra song song và kiểm thử hồi quy         |
| M4  | L9    | Bộ script khởi động/dừng, runbook, báo cáo nghiệm thu và bàn giao       |

Mỗi phase có commit riêng sau khi đạt kiểm tra phù hợp; cập nhật kết quả vào tài liệu thực hiện. Khi triển khai theo yêu cầu commit/push từng phase đã có, chỉ push source/config mẫu/test/docs, không push `.env`, database, file giáo trình hay index. Dừng tại mốc review đã thống nhất trước khi đi tiếp.

### L0 — Chốt baseline và cấu hình thử nghiệm

**Mục tiêu:** xác định đúng phiên bản code và nơi lưu dữ liệu trước mọi thao tác môi trường.

1. Fetch và xem hai commit mới của `origin/main`; đối chiếu thay đổi liên quan RAG/auth/DB. Chỉ fast-forward khi worktree sạch và không có phân kỳ.
2. Ghi commit hiện tại của repo web và repo MBA_API, branch, trạng thái dirty, phiên bản runtime/dependency.
3. Xác định DB mà web thực sự đang dùng từ cấu hình hiệu lực và kết nối runtime; không suy ra từ tài liệu lịch sử.
4. Kiểm kê database/container/volume local hiện hữu. Có tên trùng thì chọn tên khác hoặc tái sử dụng có kiểm tra, không xóa để chạy lại.
5. Backup dữ liệu nghiệp vụ đang dùng trước khi chuyển profile. Backup phù hợp với SQLite hoặc PostgreSQL đang chạy thực tế.
6. Chốt profile mới và đường dẫn: database `ptit_politics_rag_local`, collection prefix `ptit_local_`, data/cache/log riêng.
7. Chốt phạm vi model qua API và một môn thử; ghi phần còn thiếu thay vì mặc định đã có.

**Đầu ra:** inventory local đã che bí mật, commit baseline, kế hoạch backup, danh sách thông tin thiếu.

**Đạt khi:** biết rõ nguồn dữ liệu hiện tại và đích thử nghiệm; khôi phục được cấu hình trước đó; không có bước nào sẽ ghi nhầm sang server PTIT.

### L1 — Khởi động database và ứng dụng local

**Phụ thuộc:** L0.

1. Bật Docker Desktop; xác minh engine thực sự hoạt động.
2. Thêm compose riêng trong repo web, ví dụ `infra/compose.rag-local.yml`, chỉ cho MongoDB và Qdrant.
3. Chốt image tag đã kiểm tra tương thích với dependency hiện có, ghi tag/digest vào inventory. Compose mẫu MBA hiện dùng `latest`; không dùng trạng thái đó làm baseline tái lập.
4. Tạo volume riêng, publish cổng loopback, cấu hình healthcheck dùng công cụ có sẵn trong image. Compose mẫu gọi `curl`, cần xác minh binary và endpoint trước khi dùng.
5. Dùng PostgreSQL 17 đang chạy: tạo role/database local riêng, không đổi mật khẩu hoặc dữ liệu của database cũ. Nếu thiếu quyền, yêu cầu quyền tạo hoặc dùng target local trống do người dùng cung cấp.
6. Chạy migration qua tooling hiện có và các biến xác nhận host/database/user. Tạo đủ bảng trước khi chạy seed.
7. Seed dữ liệu demo vào DB riêng bằng cơ chế hiện có, không tự chạy seed lại mỗi lần startup. Nếu muốn giữ dữ liệu người dùng cũ, dùng nhánh import snapshot có kiểm tra thay cho seed.
8. Tạo tài khoản phục vụ review: admin, giảng viên của lớp thử và ít nhất hai sinh viên thuộc các lớp/môn khác nhau. Mật khẩu tham chiếu trong `DEMO_ACCOUNTS.md` hoặc cấu hình local.
9. Khởi động web/backend bằng profile local, RAG chưa bật; xác minh đăng nhập, lớp tín chỉ, ngân hàng câu hỏi và một thao tác lưu.

**Đầu ra:** compose + env mẫu + database local có schema/data tối thiểu + kiểm tra health.

**Đạt khi:** restart dịch vụ vẫn giữ dữ liệu; đăng nhập được; cổng không xung đột; script in rõ driver và DB đích nhưng không in connection string chứa mật khẩu.

Startup phải đợi điều kiện sẵn sàng, không chỉ container đã được tạo. Xem [Docker Compose — startup order](https://docs.docker.com/compose/how-tos/startup-order/).

### L2 — Đưa MBA_API lên local ổn định

**Phụ thuộc:** L1; khóa model được cấu hình.

1. Kiểm tra import cần thiết trong `.venv`; `pip check` không thay thế được kiểm tra import hoặc gọi SDK. Ghi bộ phiên bản đã chạy thành công; chỉ sửa dependency khi có lỗi cụ thể.
2. Tạo profile local riêng cho API, trỏ Mongo/Qdrant về cổng ở L1. Không ghi đè `.env` đang có; code chọn file cấu hình tường minh để tránh tự nạp nhầm `.env` thư mục cha.
3. Chuẩn hóa đường dẫn Windows tuyệt đối cho data/cache/ingestion/log; tạo thư mục cần thiết. Chặn việc dựng đường dẫn lưu file từ tên upload có `..` hoặc đường dẫn tuyệt đối.
4. Khởi động API ở loopback `4558`. Khi chạy ingestion dùng chế độ không auto-reload để tránh ngắt tác vụ đang nạp.
5. Kiểm tra thực tế các đường `/health`, `/docs`, `/openapi.json` và cấu hình `root_path=/mba_mini`. Ghi URL nào dùng trực tiếp, URL nào dành cho proxy; không mặc định ghép thêm prefix hai lần.
6. Chạy một lời gọi model ngắn và một embedding nhỏ, có giới hạn chi phí và thời gian. Không nạp cả tài liệu để thử khóa.
7. Đồng bộ embedding model + dimension giữa ingestion, query và cấu hình collection. Ghi chúng vào manifest; mismatch phải báo lỗi trước khi ghi vector.
8. Tách blocking work ở đường tích hợp khỏi event loop, cấu hình số worker/request đang chạy có giới hạn; luồng mới không ghi chat vào file JSON chung.
9. Kiểm tra thiếu khóa, Mongo tắt, Qdrant tắt, model timeout: lỗi phải xác định được thành phần gây ra.

**Đầu ra:** API local khởi động ổn, dependency baseline, cấu hình có kiểm tra, kết quả model/embedding probe.

**Đạt khi:** health/readiness phân biệt process sống với dependency sẵn sàng; restart không làm mất cấu hình; lỗi embedding dimension không bị biến thành lỗi chung.

`root_path` là thông tin triển khai phía sau proxy, cần đối chiếu cách chạy trực tiếp. Xem [FastAPI — behind a proxy](https://fastapi.tiangolo.com/advanced/behind-a-proxy/).

### L3 — Chuẩn bị một môn, giáo trình và nguồn trích dẫn

**Phụ thuộc:** L2; file giáo trình hoặc bộ snapshot đầy đủ.

1. Kiểm tra giáo trình: mở được, có text tiếng Việt và số trang. PDF scan không có text cần OCR riêng; chưa tính OCR hàng loạt vào bản thử đầu.
2. Tạo manifest một tài liệu gồm môn, phiên bản, hash file, tên, tác giả, năm/bản, source, học kỳ và quyền hiển thị.
3. Tạo mapping trong backend: `subjectId + academicTermId → source + ragTerm + collection/index version`.
4. Tạo cấu hình môn/prompt và catalog học kỳ trong Mongo local. Không chỉ tạo Qdrant collection: engine còn đọc cấu hình môn từ Mongo.
5. Chuyển trạng thái ingestion qua `queued → processing → ready` hoặc `failed`. Lưu job, bước đang chạy, số chunk, lỗi cuối và mốc thời gian để xem lại sau restart.
6. Đối với tác vụ bị ngắt, đánh dấu cần chạy lại/failed; không để `processing` vô hạn. Bản local xử lý một job nạp mỗi lần, chỉ mở rộng worker bền vững khi cần.
7. Bổ sung metadata vào từng chunk: `materialId`, `materialVersionId`, `chunkId`, `chunkSha256`, `subjectId`, học kỳ, index version, tên file gốc, text và trang nếu reader cung cấp.
8. ID/chunk hash không phụ thuộc đường dẫn thư mục temp. Hash tính trên nội dung theo quy tắc chuẩn hóa đã ghi rõ; thay nội dung hoặc bản tài liệu phải tạo version khác.
9. Tạo collection thử nghiệm theo model/dimension đã xác nhận. Một source ở pilot chỉ chứa tập tài liệu thuộc đúng môn/học kỳ và được cho phép.
10. Nạp lại cùng manifest phải nhận diện được tài liệu đã xử lý; không nhân đôi chunks hoặc gọi embedding lại không cần thiết.
11. Đăng ký material/version bên PostgreSQL, chỉ đánh dấu nguồn đủ điều kiện chat sau khi index `ready` và metadata đã kiểm tra.
12. Chạy retrieval trên 10 câu từ giáo trình; lưu chunk tìm được, file, trang và nội dung đối chiếu. Bổ sung trường hợp không có nguồn phù hợp.

**Đầu ra:** một môn có index sử dụng được, manifest, mapping nguồn và bộ câu hỏi đối chiếu.

**Đạt khi:** từng nguồn trả về truy được tới đúng file/phiên bản; không bịa số trang; upload thành công nhưng index chưa ready thì chat bị chặn với thông báo rõ; nạp lặp không tạo dữ liệu trùng.

### L4 — Hoàn thiện contract giữa backend và RAG

**Phụ thuộc:** L3.

Thêm router nội bộ trong MBA_API và dùng contract trong repo web làm nguồn định nghĩa chung:

| Endpoint dự kiến                | Trách nhiệm                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `POST /internal/v1/answers`     | Nhận câu hỏi/history/scope, thực hiện retrieval/generation, trả terminal answer |
| `GET /internal/v1/health`       | Process đang sống                                                               |
| `GET /internal/v1/readiness`    | Dependency/config cần thiết sẵn sàng; không gọi model trả phí ở mỗi health poll |
| `GET /internal/v1/capabilities` | Version contract, streaming, giới hạn và chức năng thật sự hỗ trợ               |

Các bước:

1. Xác thực Bearer service token; khóa ở backend và RAG, không có trong bundle frontend. Endpoint nghiệp vụ nội bộ không hoạt động khi khóa sai hoặc thiếu.
2. Giới hạn request body, số message history, số ký tự/token, thời gian và số request đồng thời. Backend gửi scope sau khi kiểm tra quyền người dùng.
3. Chuyển môn/học kỳ qua mapping server-side. Thiếu mapping hoặc sai học kỳ phải báo lỗi; không chọn source/học kỳ mặc định thay thế.
4. Lọc `allowedMaterialVersionIds` trước truy xuất; cả dense, rerank, context generation đều chỉ dùng tập này. Không chỉ loại citation sau khi đã cho model đọc nguồn ngoài scope.
5. Chuyển nguồn có metadata thật về canonical citation; không ghép chỉ theo tên file vì hai phiên bản có thể trùng tên.
6. Đo `totalMs`, các bước retrieval/generation và lấy token usage thực nếu SDK cung cấp. Tổng token phải gồm các model call resolve/rewrite/rerank khi có, không chỉ câu trả lời cuối.
7. Nếu metadata bắt buộc trong contract 1.0 chưa thể lấy chính xác, định nghĩa bản answer mới (đề xuất 1.1) cho các trường được phép `null`/không hỗ trợ. Cập nhật validator, capability, mock và test hai bên; không điền 0 hoặc revision giả cho đủ schema. Giữ các yêu cầu bắt buộc về nguồn và scope.
8. Dùng outcome `answered`, `abstained`, `blocked` theo quy tắc rõ. Không có nguồn đủ căn cứ thì trả lời thiếu cơ sở; không tự công nhận một câu trả lời chung là câu trả lời có nguồn.
9. Service nhận `requestId` và `Idempotency-Key`; duplicate cùng key/body trả kết quả đã lưu, key trùng/body khác báo conflict. Bản local có thể dùng Mongo local làm ledger với unique index và TTL, không chỉ cache trong RAM.
10. Đặt deadline toàn lượt; timeout các thành phần và retry cùng nằm trong ngân sách. Chỉ retry lỗi tạm thời phù hợp và giữ idempotency key.
11. Chuẩn hóa lỗi thành code ổn định, không trả stack trace/connection string ra trình duyệt.
12. Chạy contract test giữa Node client và FastAPI với trường hợp đúng/sai nguồn, thiếu token, timeout và response sai định dạng.

**Đầu ra:** router nội bộ, schema/capability thống nhất, test tương thích và kết quả gọi Node → RAG thật.

**Đạt khi:** client hiện tại nhận được response hợp lệ; nguồn ngoài scope bị chặn trước retrieval và sau response; không làm model chạy hai lần khi retry cùng request.

### L5 — Hội thoại, phân lớp, lưu kết quả và kiểm duyệt

**Phụ thuộc:** L4.

1. Tạo migration cho conversations/messages và mapping request nếu schema hiện tại chưa đáp ứng. Migration phải có phiên bản và test PostgreSQL; duy trì test SQLite nếu vẫn hỗ trợ driver này.
2. Conversation thuộc một sinh viên, lớp, môn và học kỳ. Message có ID ổn định, thứ tự, trạng thái và request liên quan. Backend xác minh quyền sở hữu khi đọc/gửi/xóa.
3. Backend tự lấy history đã lưu, giới hạn độ dài và loại lượt lỗi; không tin history/identity do trình duyệt tự khai báo.
4. Kiểm tra enrollment, trạng thái lớp/môn, bài học nếu có; scope gửi đi chỉ gồm lớp được chọn. Student ID lấy từ session đăng nhập.
5. Tạo idempotency phía backend bằng khóa duy nhất cho lượt chat; cùng một thao tác gửi chỉ sinh một logical question/request/message.
6. Bao phủ toàn chuỗi lỗi: gọi model, validate schema, resolve citation và lưu database. Mọi lỗi phải cập nhật request/message terminal, tránh mắc `processing`.
7. Không giữ transaction database mở trong lúc chờ model. Lưu trạng thái đầu, gọi RAG, rồi transaction ngắn để lưu kết quả và citation.
8. Câu trả lời hợp lệ hiển thị ngay với trạng thái chờ kiểm duyệt như yêu cầu đã chốt. Giảng viên thuộc lớp xem được hàng đợi và cập nhật kết quả review.
9. Retry từ UI dùng lại message/request ID. Nếu lưu DB sau model thất bại, có đường khôi phục từ kết quả idempotency của RAG thay vì gọi model lại.
10. Quy tắc gắn conversation với hàng đợi: lượt hỏi học thuật có câu trả lời hoặc thiếu nguồn được lưu liên kết question; lượt bị chặn không đánh dấu là answered. Tránh đẩy các message kỹ thuật hoặc lỗi mạng thành câu hỏi mới cho giảng viên.
11. Reload trang phải tải được hội thoại từ backend; mở tài khoản khác không thấy lịch sử của tài khoản trước. Đổi môn/lớp thì chuyển sang hội thoại đúng scope.
12. Luồng tích hợp nội bộ không gọi endpoint MBA để lưu/xóa lịch sử của người dùng khác. Mongo ledger kỹ thuật không thay thế lịch sử nghiệp vụ PostgreSQL.

**Đầu ra:** migration, API hội thoại, lưu câu trả lời/citation, phân lớp và workflow review.

**Đạt khi:** một lượt chat tạo đúng một bộ bản ghi; giảng viên đúng lớp xem được; người ngoài lớp bị từ chối dù sửa URL/payload; lỗi citation không để request treo.

### L6 — Giao diện chat thật và tra cứu nguồn

**Phụ thuộc:** L5.

1. Backend công bố mode/capability; UI bỏ nhãn demo chỉ khi live mode thực sự hoạt động. Không đổi sang demo âm thầm khi API lỗi.
2. Thêm danh sách hội thoại, tạo hội thoại mới và khôi phục lịch sử; giữ bố cục/tone hiện có.
3. Chọn môn/lớp với state rõ, disable thao tác xung đột khi đang gửi hoặc hủy lượt đang chạy đúng quy tắc.
4. Hiển thị đang xử lý, lỗi, thử lại và trạng thái chờ kiểm duyệt; lỗi không làm biến mất câu hỏi người dùng vừa nhập.
5. Render Markdown an toàn, không cho HTML/script từ câu trả lời chạy trong trang.
6. Hiển thị nguồn với tên tài liệu, phiên bản và trang nếu có. Link mở nguồn đi qua backend kiểm tra quyền; không trỏ tới đường dẫn file hệ thống của RAG.
7. Chỉ bật nút “mở trang” khi có số trang hợp lệ. Nếu reader không có trang, hiển thị tên tài liệu và đoạn trích.
8. Chặn gửi liên tục bằng Enter/click; một câu đang gửi có message ID cố định. Giữ trạng thái khi network chập chờn.
9. Kiểm tra desktop/mobile, chữ dài, nhiều citation, câu trả lời dài, focus bàn phím và khả năng đọc lỗi.
10. Xác minh review thay đổi thì màn chi tiết/lịch sử lấy được trạng thái mới, không giữ thông tin kiểm duyệt cũ trong UI.

**Đầu ra:** luồng chat JSON hoàn chỉnh trên trình duyệt với API thật và nguồn đúng.

**Đạt khi:** sinh viên hỏi → nhận câu trả lời → mở nguồn → reload vẫn có lịch sử → giảng viên review được. Đây là mốc bản thử nghiệm tích hợp dùng được, trước streaming.

### L7 — Streaming và hủy thao tác

**Phụ thuộc:** L6 đã đạt; không dùng streaming để che các lỗi lưu nguồn/hội thoại.

1. Thống nhất event `status`, `token`, `sources`, `terminal`, `error` với request ID và sequence. Gắn với contract event hiện hữu, thay đổi schema có version khi cần.
2. MBA_API phát sự kiện bằng đường nội bộ đã xác thực; Node chuyển tiếp bằng endpoint POST có session/CSRF phù hợp. Không cho trình duyệt gọi thẳng FastAPI.
3. Xử lý nhiều event trong một chunk, một event bị tách qua nhiều chunk, UTF-8 tiếng Việt và keepalive.
4. Kiểm tra đường đọc token không block event loop; disconnect hủy upstream và giải phóng slot sớm nhất có thể. Ghi rõ nếu provider không bảo đảm dừng tính phí ngay.
5. Backend chỉ đánh dấu câu trả lời hoàn tất sau khi terminal được validate và lưu thành công. Text đang stream được hiển thị là đang soạn, chưa coi là câu trả lời đã có nguồn xác thực.
6. Nếu kiểm tra cuối thất bại, lưu trạng thái lỗi và hiển thị cảnh báo; không giữ câu trả lời một phần như đáp án hoàn chỉnh.
7. Nút Dừng → trạng thái cancelled; đóng tab/đứt mạng → có trạng thái xử lý và cách tải lại. Không tự phát lại phần token đã gửi theo retry mù.
8. Một message chỉ có một kết quả terminal; thử lại tạo attempt rõ ràng trong cùng logical message theo quy tắc idempotency.

**Đầu ra:** UI nhận câu trả lời từng phần, dừng được, không trùng message khi mạng lỗi.

**Đạt khi:** kiểm thử với stream chậm, cắt giữa chừng, chunk nhỏ và citation sai đều cho trạng thái nhất quán ở UI và DB.

### L8 — Chất lượng, lỗi hệ thống và mức tải local

**Phụ thuộc:** L6; thêm test streaming sau L7.

1. Chạy ma trận ở mục 8; lưu bằng chứng có request ID và kết quả đã che dữ liệu bí mật.
2. Đo riêng model call đầu tiên và lượt sau; thời gian retrieval, time-to-first-token, tổng thời gian, lỗi và token usage.
3. Bắt đầu một lượt, sau đó 3 và 5 lượt chat đồng thời. Chỉ tăng khi RAM ổn và còn ngân sách model; không coi 3.000 phiên đăng nhập tương đương 3.000 lượt sinh câu trả lời cùng lúc.
4. Dùng fake provider cho bulk concurrency/retry/idempotency test; chỉ dùng model thật cho tập chất lượng và tải nhỏ được giới hạn.
5. Giới hạn ban đầu đề xuất: một lượt sinh đang chạy/người, hai lượt sinh đồng thời toàn bộ RAG, hàng đợi tối đa 10 và một ingestion job. Tất cả cấu hình được và phải đo lại.
6. Khi quá tải trả lỗi 429/503 có thông báo và hướng thử lại; không mở hàng đợi vô hạn. Đặt deadline toàn request, không nhân 30 giây theo từng retry một cách mất kiểm soát.
7. Ngắt lần lượt Mongo, Qdrant, model network và backend; xác nhận startup/readiness, thông báo lỗi và phục hồi.
8. Chạy lại test auth/RBAC, admin, lớp, luyện tập, lịch sử, schema và build phù hợp với phần thay đổi; thử luồng cũ của MBA khi thay engine chung.
9. Kiểm tra không có khóa, email/password thô hoặc file path nội bộ trong response/log client. Prompt và tài liệu thử nghiệm không tự động được đẩy vào log chẩn đoán.
10. Ghi kết quả thực đo; chưa đạt mục nào phải ghi giới hạn. Benchmark local không được dùng để tuyên bố đáp ứng production 1.000–3.000 người.

**Đầu ra:** báo cáo test và latency/RAM/error baseline local, danh sách vấn đề còn lại.

**Đạt khi:** không lộ dữ liệu khác lớp/tài khoản, không có request treo vô hạn, không nhân bản câu hỏi, phục hồi được sau lỗi dependency.

### L9 — Script vận hành, tài liệu và bàn giao

**Phụ thuộc:** L8.

1. Cung cấp script kiểm tra trước khởi động: runtime, Docker engine, cổng, DB, secret presence, đường dẫn và mapping nguồn.
2. Script start chạy dependency theo thứ tự và kiểm tra readiness; không tự seed hoặc reindex mỗi lần mở web.
3. Script stop chỉ dừng các process/container do stack thử nghiệm quản lý. Không dừng mọi tiến trình Node/Python hoặc xóa volume.
4. Cung cấp lệnh/script nạp một tài liệu, xem trạng thái và chạy lại job lỗi có giới hạn.
5. Runbook phân biệt lỗi khóa model, quota, port, DB connection, dimension, thiếu source, sai học kỳ, nguồn chưa ready và contract.
6. Hướng dẫn backup/restore DB nghiệp vụ và dữ liệu RAG vào đích thử nghiệm mới; kiểm tra khôi phục một hội thoại có citation.
7. Cập nhật README, tài liệu tích hợp chatbot, database, demo accounts nếu thay fixture và implementation history.
8. Ghi commit của cả hai repo, dependency/image versions, model/index version và bộ env mẫu. Token/giáo trình/index không nằm trong Git.
9. Demo lại đường đi sinh viên → AI → nguồn → giảng viên, rồi dừng để người dùng review trước công việc production.

**Đạt khi:** máy restart xong có thể chạy lại stack theo runbook; dữ liệu vẫn còn; người khác đọc tài liệu biết cần chuẩn bị gì và xác minh thành công thế nào.

## 6. Cấu hình dự kiến

Các tên có nhãn **mới** cần được triển khai cơ chế đọc cấu hình; thêm vào `.env` đơn thuần chưa có tác dụng. Nội dung dưới đây là cấu hình thiết kế, chưa phải hướng dẫn chạy ngay.

| Biến / cấu hình                             | Giá trị dự kiến                                    | Ghi chú                                                 |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| `NODE_ENV`                                  | `development`                                      | Bản thử local                                           |
| `VITE_DATA_SOURCE`                          | `api`                                              | UI gọi backend thật                                     |
| `DATABASE_DRIVER`                           | `postgres`                                         | Không dùng nhầm biến `DB_CLIENT`                        |
| `DATABASE_URL`                              | PostgreSQL loopback, DB riêng                      | Chứa credential local, không commit                     |
| `DATABASE_CONFIRM_HOST/NAME/USER`           | Khớp target mới                                    | Dùng với tooling migration/seed đã có                   |
| `DATABASE_SSL_MODE`                         | `disable` cho target local đã xác định             | Không dùng cấu hình này làm cấu hình production         |
| `RAG_ENABLED`                               | `false` ở L1; `true` khi L4 đạt                    | Bật có kiểm tra readiness                               |
| `RAG_DEMO_DATA`                             | `false` trong profile tích hợp thật                | Không fallback sang đáp án mô phỏng                     |
| `RAG_BASE_URL`                              | `http://127.0.0.1:4558` sau khi xác minh root path | Chỉ hoạt động khi router nội bộ đã có                   |
| `RAG_SERVICE_TOKEN`                         | Secret local sinh riêng                            | RAG cần thêm kiểm tra token tương ứng                   |
| `RAG_TIMEOUT_MS`                            | Bắt đầu 30.000; hiệu chỉnh theo số đo              | Deadline đầu-cuối và retry phải thống nhất              |
| `RAG_MAX_RETRIES`                           | Ban đầu 0; tăng tối đa 1 khi idempotency đã đạt    | Không tạo câu hỏi/model call trùng                      |
| `MONGO_URI`                                 | Loopback cổng L1                                   | Cấu hình Mongo local riêng                              |
| `MONGO_CATALOG_DB_NAME` / config/history DB | Namespace thử nghiệm đã kiểm tra với mã Python     | Một số nơi còn hardcode tên DB; phải rà trước khi seed  |
| `QDRANT_HOST` / `QDRANT_PORT`               | `127.0.0.1` / cổng host L1                         | Native Python dùng cổng publish ra host                 |
| `COLLECTION_PREFIX`                         | `ptit_local_`                                      | Cách đặt source phải duy nhất theo môn/học kỳ           |
| `DATA_ROOT` / `DATA_MBA_LARGE`              | Thư mục tuyệt đối đã tồn tại                       | File gốc và metadata                                    |
| `CACHE_FILE` / `STORAGE_PATH`               | Đường dẫn riêng cho profile                        | Không chia cache giữa các model/index không tương thích |
| `OPENAI_API_KEY` / `OPENAI_MODEL`           | Từ cấu hình hiện có, xác minh ở L2                 | Không tự đổi model chỉ vì tích hợp local                |
| Embedding model/dimension **mới nếu cần**   | Chốt sau probe                                     | Cùng cấu hình ở ingestion và query                      |
| File env được chọn **mới**                  | Profile riêng cho web và MBA_API                   | Không tự ghi đè `.env` hiện hữu                         |
| Mapping source/term/material                | Lưu có kiểm tra trong DB/manifest                  | Không hardcode giả định ID giữa hai repo                |

## 7. Bề mặt thay đổi dự kiến

Đây là danh sách để review, không khẳng định toàn bộ file mới đã tồn tại.

| Repo     | File / nhóm                                                          | Công việc                                                           |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Web      | `infra/compose.rag-local.yml` — mới                                  | Mongo/Qdrant local, volume, healthcheck                             |
| Web      | Env mẫu + `scripts/*rag-local*` — mới                                | Chọn profile, kiểm tra/start/stop, không in secret                  |
| Web      | `server/index.js`, `server/runtimeConfig.js`                         | Chọn cấu hình local tường minh, giới hạn và mode                    |
| Web      | `server/rag/client.js`                                               | Contract version, deadline, idempotency, health và streaming        |
| Web      | `server/rag/liveRepository.js`                                       | Scope lớp, history, trạng thái lỗi, source mapping, lưu kết quả     |
| Web      | `server/app.js`, repositories và migration mới                       | API hội thoại, quyền sở hữu, unique key, schema mapping             |
| Web      | `contracts/schemas`, `contracts/openapi`, mock/tests                 | Hợp đồng hai bên và hành vi thiếu metadata                          |
| Web      | `src/services/api/repositories.js`, `src/pages/student/ChatPage.jsx` | Hội thoại, mode thật, trạng thái gửi/stream và citation             |
| Web      | Thành phần nguồn + API mở học liệu                                   | Mở đúng file/trang sau kiểm tra quyền                               |
| MBA_API  | `cfg.py`, `main.py`, router nội bộ mới                               | Profile local, service auth, health/capabilities, endpoint contract |
| MBA_API  | `load_chat.py`, `course_rag.py`, `course_langgraph.py`               | History riêng, filter scope, metadata/usage, async bridge           |
| MBA_API  | `create_node.py`, ingestion/job helpers                              | Dimension, chunk metadata, ready/failed, chống nạp trùng            |
| MBA_API  | `academic_term.py`, cấu hình Mongo                                   | Mapping học kỳ chính xác, không fallback sai                        |
| Hai repo | Test và docs                                                         | Kết quả thật, rollback, version bàn giao                            |

Không chuyển toàn bộ tài khoản/lớp của web sang MongoDB, không nhập tất cả dữ liệu của MBA_BE vào web. Đồng bộ cần thiết trong đợt này là môn/học kỳ, nguồn tài liệu và protocol câu hỏi/câu trả lời.

## 8. Ma trận nghiệm thu

| Nhóm        | Tình huống                                  | Kết quả phải đạt                                                          |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Startup     | Docker engine tắt                           | Báo đúng thành phần, không treo hoặc báo RAG ready                        |
| Startup     | Cổng đã dùng                                | Xác định service xung đột; không tự kill process của người dùng           |
| Dữ liệu     | PostgreSQL target khác cấu hình xác nhận    | Migration/seed từ chối                                                    |
| Dữ liệu     | Restart stack                               | Giữ lớp, hội thoại, citation và index                                     |
| Ingestion   | Upload thành công, embedding chưa xong      | Hiện processing; không cho hỏi từ nguồn chưa ready                        |
| Ingestion   | Sai dimension                               | Báo rõ, không ghi nửa vời hoặc xóa collection cũ                          |
| Ingestion   | Nạp lại đúng file/version                   | Không nhân đôi chunk                                                      |
| Ingestion   | API restart giữa job                        | Job được nhận diện gián đoạn và có đường retry                            |
| Học thuật   | 10 câu có đáp án đối chiếu                  | Kiểm tra thủ công: nguồn thuộc đúng giáo trình; ghi nhận độ đúng từng câu |
| Ngữ cảnh    | Câu tiếp nối “ý đó nghĩa là gì?”            | Dùng đúng conversation và các lượt trước                                  |
| Ngữ cảnh    | Đổi môn/lớp                                 | Không mang lịch sử của scope cũ vào model                                 |
| Ngữ cảnh    | Không đủ căn cứ / chào hỏi                  | Không bịa nguồn; outcome và cách hiển thị nhất quán                       |
| Nguồn       | Citation version ngoài allow-list           | Từ chối; request chuyển failed và có mã lỗi                               |
| Nguồn       | Không có số trang                           | Hiện trích đoạn/tài liệu, không đoán số trang                             |
| Nguồn       | Tên file giống nhau, version khác nhau      | Mở đúng version theo ID/hash                                              |
| Quyền       | Sinh viên sửa class/subject/conversation ID | Backend từ chối truy cập trái phép                                        |
| Quyền       | Token service sai/thiếu                     | RAG nội bộ từ chối                                                        |
| Quyền       | Giảng viên khác lớp                         | Không xem/xử lý câu hỏi của lớp không được phân công                      |
| Idempotency | Double click, Enter lặp, retry mạng         | Một logical question/message; không gọi model trùng                       |
| Lỗi         | RAG, model hoặc DB lỗi sau khi tạo request  | Không để processing vô hạn; có retry/khôi phục rõ                         |
| Lỗi         | Model trả lời xong nhưng DB lưu thất bại    | Không gọi model lại mù; khôi phục từ request đã nhận diện                 |
| UI          | Reload/đăng xuất/đăng nhập tài khoản khác   | Lịch sử chính xác, không lộ state tài khoản trước                         |
| Kiểm duyệt  | Giảng viên duyệt/sửa câu AI                 | Trạng thái mới đến được trang sinh viên; có audit                         |
| Streaming   | Token UTF-8 chia nhỏ, mất mạng, Dừng        | Không lỗi chữ, không duplicate, terminal nhất quán                        |
| Tải         | 1 → 3 → 5 lượt nhỏ                          | Có số đo RAM/latency/error; quá giới hạn báo rõ                           |
| Hồi quy     | Đăng nhập, admin, lớp, luyện tập            | Các luồng đang có vẫn hoạt động                                           |

Nhóm quyền, scope nguồn, mất dữ liệu, trùng request và giả nguồn là tiêu chí bắt buộc. Chất lượng học thuật cần người phụ trách môn review; test kỹ thuật không tự xác nhận đáp án chính trị là đúng.

## 9. Rollback và kiểm soát thay đổi

1. Lưu profile trước tích hợp và backup DB trước migration; tài liệu ghi rõ thời điểm/commit.
2. Tắt live RAG có thể đưa chat sang trạng thái chưa kết nối; chỉ bật demo khi người dùng chọn profile demo rõ ràng.
3. Không xóa bảng/hội thoại/index để rollback giao diện. Migration ưu tiên thêm bảng/cột; destructive migration cần kế hoạch riêng.
4. Không dùng `docker compose down -v` trong script stop thông thường. Nếu cần xóa dữ liệu thử, liệt kê đúng volume/database và xác nhận riêng.
5. Khi thay embedding model/dimension, tạo index version mới và chuyển mapping sau kiểm tra; giữ bản cũ để đối chiếu.
6. Giữ API MBA cũ chạy được. Những thay đổi ảnh hưởng core phải có regression test và commit có thể revert.
7. Repo ChatBot nằm ngoài workspace ghi hiện tại. Khi bắt đầu triển khai cần quyền sửa đúng `MBA_API` hoặc một bản checkout local được người dùng cho phép; kế hoạch này chỉ tạo tài liệu trong repo web.

## 10. Nếu muốn model cũng chạy offline

Đó là phạm vi bổ sung, chưa nằm trong mốc M0–M4 ở trên:

- Đo VRAM khả dụng thực tế, chọn model tiếng Việt/quantization/context phù hợp, xác định dịch vụ inference local.
- Thay cả model sinh và embedding; xử lý các bước resolve/rewrite/rerank hiện cũng gọi model.
- Đánh giá tính tương thích agent/tool/chat của SDK với provider mới.
- Tạo lại embedding/index khi đổi embedding model; không dùng vector tạo bằng model khác để query.
- Đo chất lượng trên giáo trình và latency/RAM/VRAM trước khi đưa vào web.
- Kiểm tra không còn network call bắt buộc đến model ngoài máy nếu tiêu chí là offline thật.

Tên GPU không đủ để cam kết chất lượng hoặc tải của model offline. Với máy khoảng 16 GB RAM, cần benchmark riêng trước khi chốt model và quy mô.

## 11. Nguồn đối chiếu và trạng thái cuối bản kế hoạch

- Hiện trạng nội bộ: `server/rag/client.js`, `server/rag/liveRepository.js`, `server/runtimeConfig.js`, `src/pages/student/ChatPage.jsx`, `src/services/api/repositories.js`, các schema trong `contracts/schemas/chat`.
- Chatbot: `MBA_API/main.py`, `cfg.py`, `load_chat.py`, `create_node.py`, `course_rag.py`, `academic_term.py`, `README.md` và compose hiện có.
- Kế hoạch hệ thống trước đó: [CHATBOT_BACKEND_INTEGRATION.md](CHATBOT_BACKEND_INTEGRATION.md), [DATABASE.md](DATABASE.md), [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md).
- [Qdrant — collections và vector dimensions](https://qdrant.tech/documentation/manage-data/collections/).
- [Docker Compose — startup order và health conditions](https://docs.docker.com/compose/how-tos/startup-order/).
- [FastAPI — concurrency và synchronous utility functions](https://fastapi.tiangolo.com/async/#other-utility-functions).
- [FastAPI — root_path khi chạy sau proxy](https://fastapi.tiangolo.com/advanced/behind-a-proxy/).

Trong lần lập plan này chỉ kiểm tra read-only cấu hình, runtime, phần cứng và source; chưa khởi động container, tạo database, nạp giáo trình, gọi model trả phí hoặc sửa code tích hợp. File `.env` chỉ được kiểm tra các trường cần thiết; không đưa giá trị bí mật vào tài liệu.

## 12. Checklist triển khai và điểm dừng review

Các ô bên dưới đều chưa được nghiệm thu. Đây là công việc dự kiến, không phải nhật ký chức năng đã hoàn thành.

### 12.1. Đợt đầu: L0–L1, chỉ dựng nền local

- [ ] Ghi branch, commit và diff của cả hai repo; bảo toàn thay đổi đang có của người dùng.
- [ ] Xác minh lại remote và các commit mới; không tự merge khi có phân kỳ.
- [ ] Xác định driver, host và database hiệu lực của web, không in mật khẩu.
- [ ] Ghi danh sách service, container, volume và cổng đang dùng; phân biệt dữ liệu cũ với dữ liệu thử mới.
- [ ] Backup dữ liệu đang sử dụng; xác minh bản backup đọc được trước thao tác chuyển đổi.
- [ ] Chốt target local riêng và quyền tạo database; không sử dụng tài khoản quản trị DB làm tài khoản chạy app hằng ngày.
- [ ] Khởi động Docker engine và tạo Mongo/Qdrant theo profile riêng, chỉ bind loopback.
- [ ] Chạy migration vào đúng target đã xác nhận; seed chỉ khi chọn bộ dữ liệu demo cho database mới.
- [ ] Đăng nhập lần lượt admin, giảng viên và sinh viên; kiểm tra lớp, phân công và một thao tác lưu/đọc lại.
- [ ] Restart stack thử; xác nhận dữ liệu vẫn tồn tại và cấu hình cũ vẫn có thể khôi phục.
- [ ] Ghi báo cáo M0 và commit/push các thay đổi thuộc phase theo quy trình đã chốt.

**Dừng review M0:** web local và database hoạt động; chưa tuyên bố chatbot đã trả lời được. Thiếu giáo trình không chặn việc dựng nền này, nhưng phải được ghi là đầu vào còn thiếu cho L3.

### 12.2. Đợt hai: L2–L3, một môn có dữ liệu thật

- [ ] Xác minh cấu hình bí mật hiện có, import và kết nối dependency; chỉ hỏi người dùng phần thực sự thiếu.
- [ ] Chốt quyền sử dụng tài liệu với provider bên ngoài và giới hạn thử model trước lời gọi phát sinh phí.
- [ ] Probe model/embedding nhỏ; ghi thành công/thất bại và dimension, không ghi khóa.
- [ ] Kiểm tra volume cũ khi Docker chạy được: có dữ liệu dùng lại thì đối chiếu version/mapping, không tự nạp lại.
- [ ] Nếu chưa có dữ liệu dùng được, tiếp nhận một PDF có text hoặc gói bàn giao đầy đủ theo mục 13.
- [ ] Đăng ký môn, học kỳ, tài liệu, phiên bản và cấu hình prompt; không lấy tên file làm định danh duy nhất.
- [ ] Nạp một tài liệu, theo dõi đến `ready`; thử nạp lại để kiểm tra chống trùng.
- [ ] Đối chiếu retrieval và câu trả lời với bộ câu hỏi mẫu; ghi riêng lỗi kỹ thuật và lỗi nội dung.
- [ ] Ghi báo cáo M1 và commit/push phần code, test, cấu hình mẫu; dữ liệu tài liệu không đưa vào Git.

**Dừng review M1:** xem được câu trả lời và trích đoạn thuộc đúng tài liệu thử. Người phụ trách môn xác nhận nội dung trước khi dùng nó làm bộ đánh giá học thuật.

### 12.3. Đợt ba: L4–L6, ghép hoàn chỉnh vào web

- [ ] Contract test chạy qua router nội bộ có xác thực; không gọi endpoint MBA cũ như thể đã tương thích.
- [ ] Quyền lớp/môn và tập tài liệu được giới hạn trước retrieval.
- [ ] Hội thoại, câu hỏi, câu trả lời và citation được lưu với ID ổn định.
- [ ] Gửi lặp/retry không tạo câu hỏi hay model call trùng trong phạm vi bảo đảm đã kiểm thử.
- [ ] Sinh viên nhận đáp án ngay; nhãn chờ kiểm duyệt độc lập với nhãn demo/live.
- [ ] Giảng viên được phân công xem và review được; giảng viên khác lớp không truy cập được.
- [ ] Mở được tài liệu có quyền truy cập, reload giữ lịch sử, đổi tài khoản không lộ dữ liệu cũ.
- [ ] Ghi báo cáo M2; còn lỗi quyền, sai nguồn hoặc mất dữ liệu thì chưa chuyển sang streaming.

**Dừng review M2:** người dùng tự thử luồng thực tế trên trình duyệt. Đây là bản tích hợp đầu tiên đủ để review cách dùng; chưa phải nghiệm thu tải production.

### 12.4. Đợt cuối: L7–L9, hoàn thiện vận hành local

- [ ] Streaming có trạng thái đang soạn, hoàn tất, lỗi và hủy; kết quả cuối được kiểm tra và lưu trước khi báo thành công.
- [ ] Kiểm thử mất mạng, DB lỗi và API restart; có đường phục hồi, không kẹt xử lý vô hạn.
- [ ] Đo tải nhỏ với ngân sách đã chốt; chạy kiểm thử hàng loạt bằng fake provider.
- [ ] Kiểm thử hồi quy admin, lớp, luyện tập và hỏi đáp hiện có.
- [ ] Hoàn thiện script kiểm tra/start/stop và hướng dẫn chạy lại sau khi khởi động máy.
- [ ] Thử khôi phục backup vào target mới; xác minh một hội thoại và nguồn trích dẫn.
- [ ] Ghi báo cáo M3–M4, giới hạn còn lại và commit tương ứng của hai repo.

**Dừng review M4:** bàn giao bản local. Không tự chuyển lên PTIT, mở truy cập LAN/Internet hoặc tiến hành load test production.

## 13. Phiếu chuẩn bị dữ liệu giữa hai bên

### 13.1. Ai chuẩn bị phần nào?

| Bên phụ trách              | Nội dung cần chuẩn bị                                                             | Điều kiện hoàn thành                                               |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Nhóm tích hợp web          | Target DB local, tài khoản thử, lớp/môn/học kỳ và mapping ID                      | Xác minh bằng dữ liệu runtime; không chỉ đọc docs                  |
| Nhóm chatbot               | Cấu hình nguồn/prompt, phiên bản engine và metadata index nếu bàn giao dữ liệu cũ | Giải thích được source nào thuộc môn nào và dùng embedding nào     |
| Người phụ trách môn        | Một giáo trình được phép sử dụng và câu hỏi có đáp án đối chiếu                   | File đọc được; xác nhận phiên bản và phạm vi được đưa vào hệ thống |
| Chủ máy/người quản lý khóa | Quyền môi trường local và ngân sách API thử nghiệm                                | Có thể kết nối an toàn; không chia sẻ khóa qua chat/Git            |

Không bắt buộc phải có nhân sự riêng cho từng dòng; một người có thể đảm nhiệm nhiều vai trò. Nhóm tích hợp kiểm tra cấu hình đã có trước khi yêu cầu bàn giao thêm.

### 13.2. Phiếu cho một tài liệu pilot

Điền phiếu này trong hồ sơ dữ liệu local; không đặt đường dẫn chứa thông tin nhạy cảm vào tài liệu public.

| Trường         | Nội dung cần ghi                                                          |
| -------------- | ------------------------------------------------------------------------- |
| Môn và học kỳ  | Tên để người dùng kiểm tra; ID thật lấy từ backend                        |
| Lớp thử        | Lớp được chọn và tài khoản thử có enrollment/phân công tương ứng          |
| Tài liệu       | Tên đầy đủ, tác giả/đơn vị, năm, phiên bản                                |
| File           | Đường dẫn local đã xác minh; định dạng, dung lượng và SHA-256             |
| Quyền sử dụng  | Có được đưa vào model/embedding API bên ngoài không; ai được xem/tải file |
| Trang          | Có text hay scan; phân biệt số trang PDF với số trang in trên tài liệu    |
| Ánh xạ         | `materialId`, `materialVersionId`, source, học kỳ RAG và index version    |
| Cấu hình index | Embedding model, dimension, chunking và quy tắc tính hash                 |
| Nghiệm thu     | Người review, bộ câu hỏi đối chiếu, ngày và kết quả                       |

Nếu dùng snapshot cũ, bổ sung phiên bản Qdrant lúc tạo snapshot, cấu hình Mongo liên quan, file gốc, manifest và hướng dẫn restore. Không xuất toàn bộ lịch sử người dùng từ PTIT chỉ để thử một môn local; ưu tiên gói dữ liệu tối thiểu đã loại thông tin cá nhân.

**Khi chưa tìm thấy giáo trình:** kiểm tra volume và đường dẫn dữ liệu thực tế trước. Nếu vẫn thiếu, yêu cầu đường dẫn file hoặc gói bàn giao; không lấy việc có `OPENAI_API_KEY` làm bằng chứng đã có giáo trình/index.

## 14. Quy tắc xử lý lỗi và chống gửi lặp cần chốt khi viết code

Đây là quyết định thiết kế cho L4–L7, chưa phải hành vi đã triển khai.

| Tình huống                                                       | Hành vi dự kiến                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Cùng idempotency key, cùng nội dung, đang chạy                   | Trả trạng thái request đã có; không khởi tạo model call mới                                                |
| Cùng key, cùng nội dung, đã hoàn tất                             | Trả kết quả đã lưu sau khi kiểm tra quyền truy cập                                                         |
| Cùng key nhưng khác câu hỏi hoặc scope                           | Báo conflict; không ghi đè request cũ                                                                      |
| Trình duyệt mất kết nối, chưa biết server đã hoàn tất chưa       | Tra trạng thái bằng message/request ID trước khi cho gửi lại                                               |
| RAG hoàn tất nhưng Node chưa lưu được                            | Khôi phục từ kết quả RAG còn lưu; không tự gọi model lại                                                   |
| Kết quả hết thời hạn lưu hoặc trạng thái upstream không xác định | Báo rõ chưa thể khôi phục; lần gọi mới là attempt chủ động, không quảng cáo bảo đảm “chỉ tính phí một lần” |
| Người dùng sửa câu hỏi rồi gửi                                   | Tạo logical message mới với key mới                                                                        |
| Người dùng hủy                                                   | Ghi nhận yêu cầu hủy; không hứa provider dừng tính phí ngay nếu chưa có bằng chứng                         |

Khóa chống trùng phải gắn với tenant/người dùng và payload đã chuẩn hóa, không chỉ dựa vào chuỗi do client gửi. Không xóa ledger của request đang chạy bằng TTL; thời hạn lưu kết quả hoàn tất phải dài hơn cửa sổ retry/khôi phục đã công bố. Các giá trị thời hạn sẽ được chốt theo phép đo và chính sách dữ liệu, không đặt tùy ý trong mã.

Nếu tiến trình chết sau khi provider nhận câu hỏi nhưng trước khi lưu kết quả, không thể mặc định biết model có chạy hay chưa. Thiết kế phải thể hiện trạng thái chưa xác định và giới hạn này; không cam kết exactly-once cho dịch vụ ngoài hệ thống khi provider không hỗ trợ.

## 15. Mẫu báo cáo sau từng phase

Mỗi phase điền đủ các mục dưới đây. Không đánh dấu đạt nếu chỉ có code mà chưa kiểm tra đường đi liên quan.

| Mục báo cáo           | Nội dung cần ghi                                                            |
| --------------------- | --------------------------------------------------------------------------- |
| Phase / mốc review    | L0–L9 và M0–M4 tương ứng                                                    |
| Baseline              | Commit trước/sau của từng repo bị thay đổi                                  |
| Thay đổi              | File, cấu hình mẫu, migration và chức năng được thêm/sửa                    |
| Target                | Driver/database/namespace đã che bí mật; xác nhận chỉ tác động local        |
| Kiểm tra              | Lệnh hoặc kịch bản, kết quả thực tế, request ID khi cần                     |
| Dữ liệu               | Backup ở đâu trong hồ sơ local; có nạp/migrate gì, còn giữ dữ liệu cũ không |
| Chi phí và tài nguyên | Có gọi model thật không; số lượt, usage được đo, RAM/latency nếu có         |
| Giới hạn              | Chưa kiểm tra gì, lỗi còn lại, thiếu dữ liệu hay quyền nào                  |
| Rollback              | Cách trở về trạng thái trước phase và bằng chứng đã kiểm tra phù hợp        |
| Git / review          | Commit đã tạo, push thành công hay bị chặn; quyết định tại mốc review       |

Các lệnh đã có trong `package.json` để chọn theo phạm vi thay đổi: `npm run lint`, `npm run contract:validate`, `npm run contract:test`, `npm run test`, `npm run build`. Trước bàn giao toàn bộ cần chạy bộ kiểm tra phù hợp và ghi rõ lỗi baseline nếu có. Các lệnh này không thay thế smoke test với PostgreSQL, FastAPI và model thật.

`npm run check` hiện gộp kiểm tra định dạng, lint, contract, test và build. Không chạy migration/seed hoặc load test như một phần kiểm tra định dạng tài liệu. Script start/stop local RAG trong mục L9 vẫn là đầu ra dự kiến, chưa thể coi là lệnh có sẵn.

**Trạng thái sau phần bổ sung:** mới hoàn thiện kế hoạch. Bước triển khai đầu tiên đề xuất là L0–L1, báo cáo M0 rồi dừng review; chưa bật live RAG hoặc nạp giáo trình trong lần viết tài liệu này.
