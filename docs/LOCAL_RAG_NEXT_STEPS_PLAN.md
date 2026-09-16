# Kế hoạch các bước tiếp theo cho chatbot RAG

Ngày lập: 14/09/2026. Trạng thái: **đang triển khai; P0 đạt, P1 bị chặn bởi API key 401,
P2 đang thực hiện bằng fixture offline**.

Mục tiêu đề xuất: từ pilot BM25 hiện tại tiến tới **một môn học dùng giáo trình thật,
trả lời bằng model, có nguồn kiểm chứng, lịch sử và kiểm duyệt**; sau đó mới tối ưu và streaming.
Local ở đây là ứng dụng, dữ liệu và vector database chạy trên máy; model/embedding vẫn dùng API.
Chạy cả model offline là nhánh khác, cần chốt lại phạm vi và benchmark phần cứng.

## 1. Điểm xuất phát đã đối chiếu

- Web: HEAD `b4d93d4`, có thay đổi chưa commit của pilot và của người dùng.
- MBA_API: HEAD `af0bf15`; pilot chỉ import hàm BM25, chưa sửa engine legacy.
- Đã có web/API ở cổng 3101, adapter 8787, SQLite pilot riêng, 4 đoạn tài liệu mẫu.
- Đã kiểm tra trong lượt trước: smoke HTTP đạt; 10 test Python đạt; 184 test web/backend đạt khi loại suite load-test đang lỗi parse; build/lint/contract validation đạt.
- Model thật chưa chạy thành công: lần probe trước trả `401 invalid_api_key`. Chưa probe lại trong lượt lập plan.
- Không có bằng chứng ingestion/Qdrant, LangGraph đầy đủ hay chất lượng trên giáo trình thật đã đạt.
- Chưa QA trực quan vì lượt thử trước không có browser kết nối với công cụ.

Nguồn hiện trạng: [Runbook pilot](LOCAL_RAG_PILOT_RUNBOOK.md),
[báo cáo conflict](RAG_FLOW_AND_CONFLICT_REPORT.md),
[plan tích hợp trước](LOCAL_RAG_INTEGRATION_PLAN.md) và code hiện tại.
Baseline Git trong báo cáo conflict là ảnh chụp trước thao tác bỏ hai commit;
không dùng baseline đó thay cho HEAD đã đối chiếu ở trên.

### Những khoảng trống cụ thể cần sửa

1. `allowedSources()` trong `server/rag/liveRepository.js` lọc theo môn và approved material,
   chưa ràng buộc đầy đủ lớp được chọn, học kỳ, phiên bản được xuất bản và index ready.
2. `scope.classIds` hiện chứa các lớp ghi danh của môn, không chỉ lớp đang hỏi.
3. Schema request 1.0 chưa có academic term/index version; `additionalProperties:false`
   nên không thể tự thêm field rồi coi contract vẫn tương thích.
4. UI repository chỉ gửi content/subject/class, chưa gửi conversation/message ID.
5. Adapter có idempotency cache trong RAM; Node vẫn tạo question/request mới trước khi gọi provider.
6. Lỗi ở bước resolve citation hoặc ghi kết quả sau provider chưa cùng nằm trong đường xử lý lỗi;
   có thể để request ở `processing` dù đã thất bại.
7. Citation chuẩn có chunk ID/hash/section, nhưng bảng citation nghiệp vụ hiện không lưu tách hết các trường này;
   một phần chỉ còn trong raw response JSON.
8. `isDemo:false` không chứng minh có LLM; cần dùng metadata chế độ nhất quán ở chat, lịch sử và báo cáo.

## 2. Các quyết định kiến trúc đề xuất

| Quyết định         | Đề xuất cho đợt tới                                                                                  | Tradeoff / lựa chọn khác                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Mốc ưu tiên        | Một môn, một bộ giáo trình được xác nhận, non-stream trước                                           | Demo model trên mẫu nhanh hơn nhưng không nghiệm thu được chất lượng học thuật                                      |
| Database nghiệp vụ | Giữ DB pilot riêng trong các mốc đầu; thiết kế migration tương thích lớp DB đang có                  | Hoãn PostgreSQL giảm thay đổi đồng thời; vẫn phải kiểm tra PostgreSQL trước staging nếu đó là đích triển khai       |
| Vị trí RAG service | Phát triển router nội bộ và core tái sử dụng trong MBA_API sau khi được duyệt phạm vi hai repo       | Giữ adapter ở web ngắn hạn nhanh hơn nhưng dễ hình thành engine thứ hai; không duy trì hai pipeline dài hạn         |
| MongoDB            | Không dùng làm nguồn history thứ hai của đường mới; chỉ bật nếu core còn thật sự cần cấu hình legacy | Nếu tái sử dụng nguyên `load_chat`, phải dựng Mongo và xử lý phụ thuộc; không hứa bỏ Mongo trước khi tách được core |
| Vector store       | Qdrant local, collection và volume riêng, phiên bản image được pin sau kiểm tra tương thích          | Thêm dịch vụ cần vận hành; giữ offline BM25 làm chế độ kiểm thử chủ động, không fallback ngầm                       |
| Orchestration      | Một query → retrieval → một generation là baseline                                                   | Có thể kém hơn ở câu nhiều ý; chỉ thêm resolve/decompose/rewrite/rerank khi có bằng chứng từ eval                   |
| Phạm vi legacy     | Node gọi thẳng router RAG nội bộ, không vòng qua MBA_BE/MBA_UI                                       | Đường legacy vẫn cần regression nếu sửa core dùng chung; không đồng nghĩa đã sửa mọi lỗi legacy                     |

Việc hoãn PostgreSQL/MongoDB là **đề xuất điều chỉnh** so với plan trước, không phải quyết định đã duyệt.
Không đổi model hoặc dimension chỉ để chạy được; kiểm tra cấu hình ingestion và query cùng một manifest.

## 3. Thứ tự và điểm nghiệm thu

```text
P0 Baseline
  → P1 Model thật trên mẫu (cần key hợp lệ)
  → P2 Contract + quyền + vòng đời request
  → P3 Ingestion + index có provenance
  → P4 RAG một môn với giáo trình thật
  → P5 Hội thoại + idempotency bền vững + review
  → P6 Tối ưu có đo lường
  → P7 Streaming / cancel
  → P8 Vận hành và bàn giao local
```

P2 và phần parser/manifest/test của P3 có thể làm bằng fixture trong lúc chờ key.
Không đưa giáo trình thật vào đường live trước khi P2 đạt; không bật tự retry trước P5.
Không gọi P1 là hoàn thành RAG thật; mốc sử dụng thử một môn là **P4 + P5**.

### P0 — Khóa baseline, sửa nền kiểm thử

**Công việc**

- P0.1: phân loại thay đổi người dùng/pilot; ghi SHA, dependency versions, cấu hình không chứa secret.
- P0.2: xác minh và sửa đúng nguyên nhân suite `scripts/load-test.test.js` lỗi parse;
  kiểm tra môi trường test Node/transform của script, không mặc định xóa shebang hay loại suite vĩnh viễn.
- P0.3: bổ sung kiểm tra start/stop, port conflict, thiếu checkout/Python/config; lưu PID do stack quản lý.
- P0.4: tạo baseline regression cho offline pilot và thống nhất bộ test chạy ở mỗi commit.
- P0.5: đối chiếu diff remote MBA_API khi chuẩn bị sửa core; không tự pull/merge các commit chưa review.

**Đầu ra:** baseline manifest và checklist test xanh, danh sách phần giữ nguyên.

**Đạt khi:** chạy lại pilot theo runbook; full suite không cần loại test; không chạm DB thường,
không phục hồi hai commit đã bỏ, không mất thay đổi hiện có.

### P1 — Xác minh model thật trên tài liệu mẫu

**Phụ thuộc:** người dùng thay key hợp lệ trong cấu hình local; chốt trần chi phí thử trước khi gọi.

- P1.1: nạp env từ đường dẫn tường minh; phân biệt thiếu key, key lỗi, quota/rate limit và network timeout.
- P1.2: chạy một completion nhỏ và một embedding nhỏ; ghi model thực trả về, usage, dimension, latency.
- P1.3: bật chế độ model của pilot, chạy khoảng 10 câu mẫu có giới hạn; không retry tự động.
- P1.4: kiểm tra JSON hỏng, output bị cắt, model từ chối, citation không hợp lệ; lỗi không được biến thành đáp án mẫu.
- P1.5: tách health, index readiness và thời điểm provider probe thành công gần nhất;
  không gọi model tính phí theo mỗi health poll.

**Đầu ra:** báo cáo probe và baseline end-to-end trên mẫu, không chứa key/prompt riêng tư trong log.

**Đạt khi:** UI nhận câu model thật, usage khớp response, nguồn đúng fixture; lỗi rõ ràng;
nhãn model không bị hiểu thành bảo đảm chất lượng hoặc key luôn hợp lệ.

**Nếu vẫn 401:** dừng nhánh gọi provider; tiếp tục P2/parser/test offline. Không tự chọn nhà cung cấp hoặc model khác.

### P2 — Khóa contract, quyền truy xuất và trạng thái lỗi

**Liên quan:** C03, C04, C05, C10, C12.

- P2.1: thống nhất schema Node/Python; đề xuất version mới cho academic term, index version và capability.
  Có fixture/test tương thích; không thêm field ngoài schema 1.0 hiện hành.
- P2.2: Node tự xác định scope từ user, lớp được chọn, ghi danh còn hiệu lực, môn và học kỳ;
  không tin whitelist, collection hoặc history do browser tự gửi.
- P2.3: whitelist chỉ gồm version được cấp cho lớp, được phê duyệt/xuất bản theo policy và index ready.
  Term không tồn tại trả lỗi; không fallback sang latest.
- P2.4: định nghĩa namespace request ID nghiệp vụ/correlation ID/provider job ID, tránh dùng lẫn;
  quy định body limits và lỗi chung hai bên.
- P2.5: bao phủ lỗi retrieve, citation, persistence trong vòng đời request;
  phân biệt provider thất bại với provider đã trả nhưng DB lưu lỗi. Có recovery/reconciliation cho request bị treo.
- P2.6: lưu đầy đủ chunk ID/hash/section/index version phục vụ kiểm chứng; page có thể thiếu,
  không tạo số trang giả. Thêm migration và test rollback tương ứng.
- P2.7: test cùng môn khác lớp/kỳ/version, nguồn bị thu hồi giữa lúc xử lý, lesson sai lớp,
  request quá dài và service token sai. Kiểm tra quyền lại trước khi trả hoặc replay dữ liệu nhạy cảm.

**Đầu ra:** contract versioned, mapping scope server-side, test phân quyền và lỗi vòng đời request.

**Đạt khi:** không có chunk ngoài scope được đưa vào prompt; Node vẫn kiểm tra lần cuối;
lỗi không để request `processing` vô hạn. Thay đổi quyền không bị cache cũ vô hiệu hóa.

### P3 — Một đường ingestion, index và provenance thống nhất

**Liên quan:** C01, C02, C12, C14. Cần file giáo trình có quyền sử dụng để nghiệm thu thật.

- P3.1: bắt đầu một PDF có text, một môn; ghi nguồn, phiên bản, tác giả, quyền sử dụng.
  Nếu chưa có, tiếp tục fixture nhưng ghi chưa đạt nghiệm thu giáo trình. OCR là việc riêng nếu PDF scan.
- P3.2: tạo manifest gồm file hash, material/version, môn/kỳ, parser/chunker version,
  embedding model/dimension, index version và quy tắc chuẩn hóa text.
- P3.3: thống nhất splitter, chunk size/overlap có cấu hình; giữ heading và provenance trang.
  Đánh giá số trang PDF và số trang in riêng, không suy đoán khi reader không cung cấp.
- P3.4: dựng Qdrant riêng; probe dimension rồi so schema trước upsert/query.
  Khi đổi embedding/chunking, tạo index mới; không ghi đè collection cũ hoặc cắt vector cho vừa.
- P3.5: tạo stable chunk ID, SHA-256, version metadata; payload phục vụ lọc tenant/môn/kỳ/version.
- P3.6: ingestion job bền vững: queued → processing → ready/failed, có checkpoint và recovery sau restart;
  index chưa hoàn chỉnh không được công bố ready.
- P3.7: ingest lại manifest giống nhau không tạo chunk trùng; thay file tạo version mới;
  chuyển mapping active chỉ sau kiểm tra, giữ index cũ để rollback.
- P3.8: file thật lưu private và truy cập qua endpoint có auth; không đặt giáo trình vào `public/`
  như fixture. Kiểm tra path traversal, loại file, kích thước và upload trùng.

**Đầu ra:** index một môn, manifest, danh sách chunk kiểm chứng, báo cáo ingestion và lệnh reindex.

**Đạt khi:** nạp hai lần không tăng số chunk; restart không mất trạng thái;
dimension mismatch bị chặn trước ghi; mọi citation truy được tới đúng phiên bản nguồn.

Qdrant yêu cầu schema chiều vector tương thích; payload filtering cho phép ràng buộc điều kiện tìm kiếm.
Đề xuất trên dựa trên [Collections](https://qdrant.tech/documentation/manage-data/collections/)
và [Filtering](https://qdrant.tech/documentation/search/filtering/), chưa chọn image tag trước kiểm tra môi trường.

### P4 — RAG thật một môn, baseline đơn giản

**Liên quan:** C03, C07, C08, C12.

- P4.1: tách core retrieval/generation khỏi `load_chat` và history JSON;
  router nội bộ gọi core trực tiếp, không HTTP vòng về chính MBA_API.
- P4.2: chạy dense retrieval có scope và BM25 trên tập tài liệu được phép, hợp nhất và loại trùng.
  Nêu rõ BM25 trên toàn corpus được phép hay chỉ dense candidates; không gọi hai cách đó là cùng một baseline.
- P4.3: baseline chỉ một query, một generation; top-k và context có cấu hình, đếm token bằng tokenizer phù hợp
  thay cho giới hạn byte hiện tại. Phân bổ riêng system/history/context/output.
- P4.4: prompt versioned cho identity/grounding/style/policy; tài liệu và history là dữ liệu,
  không được ghi đè chỉ dẫn hệ thống. Không sửa prompt bằng xóa dòng regex.
- P4.5: model chọn ID nguồn từ context; service dựng quote/hash từ text gốc;
  kiểm tra nguồn hợp lệ tách biệt với kiểm tra nội dung thực sự được nguồn hỗ trợ.
- P4.6: có cơ chế abstain dựa trên kết quả đánh giá; không lấy ngưỡng score cũ làm chân lý cho model/index mới.
- P4.7: QA trình duyệt desktop/mobile: hỏi, lỗi, không nguồn, mở trang nguồn đúng version,
  citation bị từ chối, nội dung dài và trạng thái chờ.

**Đầu ra:** một môn hỏi được trên giáo trình thật, báo cáo chất lượng baseline và ví dụ citation đối chiếu.

**Đạt khi:** vượt các tiêu chí bộ eval ở mục 4; không chỉ kiểm tra HTTP 200 hay JSON đúng schema.
Giữ các endpoint legacy và chạy regression tương ứng nếu sửa module dùng chung.

### P5 — Hội thoại, chống gửi lặp bền vững và review

**Liên quan:** C06, C10, C11.

- P5.1: thêm conversation/message ID ổn định; conversation thuộc user và scope cụ thể.
  Reload đọc lại từ DB; đổi môn/lớp không mang history cũ sang âm thầm.
- P5.2: backend tự tải history được phép, giới hạn số lượt/token; không nhận nguyên history đáng tin từ client.
  Xác định cách dùng câu assistant chưa được duyệt hoặc bị thu hồi trong follow-up.
- P5.3: tạo logical request trước provider bằng transaction/unique constraint;
  lưu idempotency key, hash payload đã chuẩn hóa, attempt, status và timestamps.
- P5.4: cùng key/body trả trạng thái hoặc kết quả cũ; cùng key/body khác trả 409;
  scope đổi hoặc quyền bị thu hồi phải được kiểm tra lại, không trả lại cache mù.
- P5.5: ledger phía provider cũng bền vững, không chỉ RAM. Chốt một nơi lưu ledger RAG riêng
  (SQLite local hoặc kho metadata đã chọn), không để hai service cùng ghi trực tiếp DB nghiệp vụ.
- P5.6: xử lý khoảng lỗi provider đã nhận request nhưng chưa biết kết quả bằng trạng thái
  unknown/reconcile; không hứa exactly-once với nhà cung cấp khi chưa có cơ chế bảo đảm tương ứng.
- P5.7: lưu response + citations + terminal status nhất quán; outbox/recovery cho phần liên dịch vụ khi cần.
  Review/published-only phải thực sự chặn công bố, không chỉ gắn badge “chờ duyệt”.
- P5.8: test double-click, nhiều tab, retry cùng lúc, restart, lỗi DB sau generation;
  quyền giảng viên, lịch sử chỉnh sửa, phản hồi và các nhãn extractive/model trên trang liên quan.

**Đầu ra:** history có quyền sở hữu, ledger/recovery, review flow và test failure injection.

**Đạt khi:** một logical message không tạo nhiều question/answer do retry trong phạm vi test;
không gọi lại model nếu kết quả đã được lưu; trường hợp chưa biết kết quả có trạng thái rõ ràng.

### P6 — Tối ưu tốc độ và tài nguyên theo số đo

**Liên quan:** C08, C09, C10; đáp ứng các mục model call/retrieval tuần tự/blocking/khởi tạo lại đã rà soát.

- P6.1: trace từng stage từ đầu (P1–P4), tại đây chạy benchmark đầy đủ:
  queue, history/config, resolve, embedding, search, rerank, generation, persist và tổng thời gian.
- P6.2: cache client/prompt/index wrapper theo version; memory hội thoại luôn riêng request.
  Cache retrieval phải chứa tenant/scope/allowlist/index/version trong key và có invalidation khi thu hồi nguồn.
- P6.3: A/B từng thay đổi: resolve chỉ cho follow-up; decompose chỉ câu nhiều ý;
  rewrite/rerank chỉ khi baseline không đạt. Không bật tất cả cùng lúc.
- P6.4: batch/parallel độc lập với semaphore; không song song bước phụ thuộc kết quả trước;
  test SDK/client dùng chung và không để state của request A lọt sang request B.
- P6.5: async client ở chỗ phù hợp; bounded worker cho phần sync; tránh synchronous iterator và I/O trên event loop.
  FastAPI chạy route `def` trong threadpool, nhưng lời gọi helper sync bên trong `async def` không tự được chuyển đi:
  [tài liệu concurrency](https://fastapi.tiangolo.com/async/).
- P6.6: một deadline gồm cả queue; budget cho từng stage, không nhân timeout theo retry.
  Bắt đầu đề xuất 2 lượt xử lý đồng thời toàn RAG, queue 10, 1 ingestion job; điều chỉnh sau đo.
- P6.7: test tải bằng fake provider trước; model thật chỉ tải nhỏ 1/3/5 request trong ngân sách đã chốt.

**Đầu ra:** bảng trước/sau P50/P95, số call, token, chất lượng, RAM/CPU và error rate.

**Đạt khi:** chất lượng không giảm quá ngưỡng thống nhất; không request treo vô hạn;
có lợi ích latency/cost đo được. Không coi cắt bước đi là đã chứng minh tối ưu engine legacy.

### P7 — Streaming, reconnect và hủy

**Phụ thuộc:** ledger P5 ổn định; không dùng streaming để chữa lỗi request/nguồn.

- P7.1: dùng schema event hiện có (`queued`, `processing`, `retrieval`, `delta`, `terminal`, `error`);
  bổ sung cancel/resume có version nếu thiếu, không tự invent event ngoài contract.
- P7.2: browser chỉ nối Node; Node nối RAG service. Mỗi event có request ID và sequence.
- P7.3: resume đọc lại cùng job; chưa có token không được tự POST non-stream tạo job mới.
- P7.4: token đang stream là bản đang soạn; chỉ hoàn tất sau khi terminal/citation được validate và lưu.
  Kiểm tra publication policy: nội dung phải duyệt trước thì không stream bản chưa duyệt tới sinh viên.
- P7.5: stop/disconnect giải phóng slot; ghi trạng thái cancel; không cam kết provider dừng tính phí tức thời.
- P7.6: test UTF-8 tiếng Việt, event chia/gộp nhiều packet, mất mạng trước token đầu/giữa stream,
  lỗi citation cuối, reconnect và thiếu terminal event.

**Đầu ra:** streaming có resume/cancel và nhất quán giữa UI/DB.

**Đạt khi:** không duplicate job/terminal, không hiển thị bản lỗi hoặc chưa duyệt như đáp án hoàn chỉnh.

### P8 — Tái lập, phục hồi và bàn giao

**Liên quan:** C13, C14; PostgreSQL staging là mốc riêng nếu được chọn.

- P8.1: start/stop/preflight với env riêng, image/dependency pin, loopback-only, health có nghĩa rõ.
- P8.2: restart không tự seed giáo trình hoặc embedding lại; cleanup chỉ nhắm tài nguyên do stack quản lý.
- P8.3: backup/restore DB + source files + index manifest/snapshot vào đích thử mới;
  đối chiếu một hội thoại/citation sau restore.
- P8.4: không log secret, full prompt hay tài liệu riêng tư mặc định; có retention, redaction và request correlation.
- P8.5: nếu chuyển PostgreSQL, dùng migration/export/import/parity test riêng;
  không đổi DB giữa một đợt đo retrieval mà không dựng lại baseline.
- P8.6: bàn giao runbook, known limitations, kết quả test/eval, SHA hai repo và config versions;
  người khác chạy lại được sau restart máy.

**Đạt khi:** restore có kiểm chứng, runbook chạy được và toàn bộ regression suite đạt;
không dùng benchmark local để tuyên bố sẵn sàng production nhiều nghìn người.

## 4. Bộ nghiệm thu và cách đo

Tạo trước một bộ khoảng **60 câu**: 20 trực tiếp, 10 diễn đạt lại/đồng nghĩa, 10 nhiều ý,
10 follow-up, 10 thiếu nguồn/ngoài phạm vi. Mỗi câu có nguồn kỳ vọng hoặc nhãn phải abstain.
Case phân quyền và prompt injection là bộ riêng, không tính chung để làm đẹp điểm retrieval.
Giữ một phần câu hỏi làm tập kiểm tra không dùng để chỉnh prompt/ngưỡng.

Ngưỡng dưới đây là **đề xuất cần duyệt**, chưa phải kết quả đã đo:

| Tiêu chí                       | Đề xuất nghiệm thu                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Rò nguồn khác quyền/kỳ/version | 0 vi phạm trên toàn bộ case âm tính                                                                            |
| Citation ID/hash/quote/version | 100% kiểm tra kỹ thuật đạt; kiểm tra hỗ trợ nội dung riêng                                                     |
| Retrieval                      | Ít nhất 90% câu có đáp án tìm được ít nhất một đoạn chuẩn trong top 5; báo cáo riêng độ phủ nhiều ý            |
| Grounding câu trả lời          | Ít nhất 90% câu có đáp án được người review đánh giá đủ căn cứ; không tự đặt điểm bởi chính model sinh         |
| Abstention                     | Ít nhất 90% case thiếu nguồn từ chối đúng; đồng thời báo cáo tỷ lệ từ chối nhầm                                |
| Idempotency/recovery           | Không bản ghi trùng trong test; trạng thái uncertain không tự retry mù                                         |
| Latency                        | Đo P50/P95, cold/warm, queue và provider riêng; chốt SLO sau baseline thật, không lấy 0ms offline làm mục tiêu |
| Tối ưu P6                      | Gợi ý: giảm ≥20% P95 hoặc chi phí/lượt trên tập cố định; chất lượng giảm không quá 2 điểm phần trăm            |
| Vận hành                       | Không job treo vô hạn; restart/restore/cancel theo kịch bản đã test                                            |

Với mẫu nhỏ, tỷ lệ chỉ là chỉ báo pilot; lưu từng case và lỗi thay vì khẳng định thống kê production.
Mọi báo cáo có dataset version, SHA, model/index/prompt version, cấu hình, số lần lặp và chi phí thực.

## 5. Bề mặt thay đổi dự kiến

| Khu vực                                                               | Phạm vi dự kiến                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/local-rag/*`, `scripts/start-local-rag.mjs`                  | Giữ fixture/offline regression; chuyển vai trò sang launcher/smoke cho service chính           |
| `server/rag/liveRepository.js`, `server/rag/client.js`                | Scope, request lifecycle, IDs, lỗi, deadlines và replay                                        |
| `server/app.js`, `server/database.js`, lớp DB/migrations              | Conversation/job/review/readiness/source access; giữ tương thích backend DB                    |
| `contracts/schemas/chat/*`, OpenAPI, examples, validators             | Schema versioning, term/index, job/events/capability; test hai phía                            |
| `ChatPage.jsx`, API repository và các trang lịch sử/review            | Conversation, citations, modes, lỗi, reload; streaming làm sau                                 |
| `MBA_API` router/core mới, các module retrieval liên quan             | Core không phụ thuộc history legacy, ingestion thống nhất, async/bounded concurrency           |
| `MBA_API/create_node.py`, `bulk_embed_data.py`, `analyze_chunking.py` | Rà và gom đường ingestion; công cụ diagnostic nhận config/manifest, không hard-code collection |
| Cấu hình local/infra và docs                                          | Qdrant profile riêng, version pin, backup/restore, startup và báo cáo eval                     |

Ước lượng sơ bộ: thay đổi nhiều file ở cả hai repo, gồm migration/schema/test; không phải chỉ thêm một endpoint.
Đường ghi ngoài workspace `AI_Trợ_Giảng` cần quyền phù hợp khi thực thi; bản plan không tự cấp quyền đó.

## 6. Ước lượng và chia đợt review

Ước lượng **ngày công**, giả định một lập trình viên quen codebase, chưa tính thời gian chờ key,
giáo trình/reviewer, OCR hàng loạt hoặc xử lý dependency phát sinh:

| Đợt | Nội dung | Khoảng dự kiến | Điểm dừng review                                     |
| --- | -------- | -------------- | ---------------------------------------------------- |
| A   | P0–P1    | 1–2 ngày       | Nền test xanh, model thật trên mẫu, chi phí có số đo |
| B   | P2–P4    | 5–9 ngày       | Một môn có index và câu trả lời kiểm chứng được      |
| C   | P5       | 2–4 ngày       | Lịch sử/review và chống trùng bền vững; MVP một môn  |
| D   | P6–P8    | 5–9 ngày       | Tối ưu, streaming và vận hành local                  |

Tổng đề xuất khoảng **13–24 ngày công**, cần ước lượng lại sau P1/P3.
Đây không phải cam kết deadline. PostgreSQL migration sâu hoặc chuyển cả model offline cần dự toán riêng.

Mỗi đợt chỉ bắt đầu sau khi đợt trước đạt hoặc có ngoại lệ được ghi rõ.
Không tạo commit/push/merge/reset trong lượt lập kế hoạch; cách chia commit sẽ chốt khi triển khai.

## 7. Rollback và những gì không đổi

- Giữ chế độ extractive mẫu chạy độc lập để regression; chọn mode chủ động, không fallback che lỗi.
- Trước migration backup DB pilot; không dùng DB người dùng hiện tại làm nơi thử migration.
- Index mới có version riêng; rollback mapping về index cũ, không xóa index để rollback.
- Feature flags cho model, multi-turn, tối ưu và streaming; tắt feature không được bỏ kiểm tra quyền.
- Giữ MBA_BE/MBA_UI, endpoint legacy và hai commit đã bỏ ngoài phạm vi thay đổi tự động.
- Không triển khai public, không mở LAN, không thay model, không bật tracing gửi dữ liệu ra ngoài khi chưa chốt.

## 8. Đầu vào và lựa chọn cần chốt

1. **Ưu tiên:** đề xuất MVP một môn; có thể chỉ làm đợt A để demo nhanh, hoặc lập nhánh model offline riêng.
2. **Provider:** key hợp lệ trong env local và trần ngân sách cho probe/eval; không gửi key trong chat.
3. **Dữ liệu:** một giáo trình được phép sử dụng, môn/kỳ/lớp/phiên bản và người kiểm tra nội dung.
4. **Kiến trúc:** có đồng ý hoãn PostgreSQL/Mongo không bắt buộc trong đợt đầu và đưa core về MBA_API không?
5. **Nghiệm thu:** ai review bộ câu hỏi; có chấp nhận ngưỡng pilot đề xuất ở mục 4 không?

Khuyến nghị bắt đầu **đợt A**, chuẩn bị song song contract/eval và đầu vào P3.
Chưa triển khai code theo kế hoạch này cho đến khi người dùng xác nhận phạm vi và yêu cầu tiếp tục.
