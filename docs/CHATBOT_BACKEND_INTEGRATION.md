# Ghi chú tích hợp Backend PTIT và Chatbot/RAG

> Trạng thái: **Draft để hai đội review và ký xác nhận trước khi triển khai**
> Phiên bản tài liệu: `1.0`
> Phạm vi: production target cho tối đa khoảng **3.000 phiên đăng nhập đồng thời**
> Contract demo hiện tại vẫn được mô tả tại `docs/API.md` và `docs/FRONTEND_CONTRACTS.md`.

## 1. Mục tiêu

Mục tiêu tích hợp:

1. Sinh viên gửi câu hỏi trong đúng lớp/học phần đã được phép truy cập.
2. PTIT tự host dữ liệu, RAG và vector index; chỉ gọi model qua API để sinh câu trả lời.
3. Câu trả lời hợp lệ được hiển thị ngay dưới trạng thái `provisional`.
4. Mọi citation phải truy ngược được tới đúng tài liệu, phiên bản, trang/đoạn đã phê duyệt.
5. Hệ thống không mất job, không tạo câu trả lời trùng khi retry và có thể vận hành khi model API chậm
   hoặc tạm thời không khả dụng.

## 2. Các giả định đã chốt

| Nội dung               | Quyết định                                                      |
| ---------------------- | --------------------------------------------------------------- |
| Người dùng bình thường | Khoảng 1.000 phiên đồng thời                                    |
| Cao điểm gần thi       | Khoảng 2.000–3.000 phiên đồng thời                              |
| Đăng nhập              | Microsoft Entra ID/Outlook với tài khoản PTIT                   |
| RAG và dữ liệu         | PTIT tự host                                                    |
| Model sinh câu trả lời | Gọi qua API                                                     |
| Publication            | Hiển thị ngay sau kiểm tra tự động, trạng thái `provisional`    |
| Kiểm duyệt             | Theo rủi ro và lấy mẫu, không bắt mọi câu chờ giảng viên        |
| Database production    | PostgreSQL; SQLite chỉ dùng cho demo/local                      |
| Giao tiếp trình duyệt  | Chỉ qua PTIT Backend; trình duyệt không gọi model/RAG trực tiếp |

## 3. Kiến trúc đích

```text
Browser
   |
CDN / WAF / Load balancer
   |
PTIT Backend API (2+ stateless replicas)
   |-- PostgreSQL: users, classes, conversations, jobs, answers, reviews, audit
   |-- Redis: distributed rate limit, cache, short-lived state
   |-- Transactional outbox / Job queue
   |       |
   |       +--> RAG workers
   |                |-- Document/object storage
   |                |-- Embedding + vector index
   |                |-- Retrieval + reranking
   |                +-- External model API
   |
   +-- SSE/polling cho Browser
```

### Quy tắc kiến trúc bắt buộc

- Browser không nhận model API key, vector database credential hoặc service token.
- RAG service không xác thực người dùng cuối và không tự quyết định quyền truy cập môn/lớp.
- RAG service không ghi trực tiếp vào database nghiệp vụ của Backend PTIT.
- Backend PTIT không giữ transaction database trong thời gian gọi model.
- Tạo `question + rag_request + outbox_event` trong cùng một transaction.
- Worker gọi model sau khi transaction đã commit.
- Kết quả model chỉ được lưu/công bố sau khi Backend hoặc lớp validation tin cậy xác minh schema,
  citation, phạm vi nguồn và safety.

## 4. Phân định trách nhiệm

| Khả năng                      | Backend PTIT          | Chatbot/RAG                      | Model API                         |
| ----------------------------- | --------------------- | -------------------------------- | --------------------------------- |
| Microsoft Entra ID và session | Chủ sở hữu            | Không nhận dữ liệu đăng nhập     | Không nhận                        |
| Vai trò sinh viên/giảng viên  | Chủ sở hữu            | Chỉ nhận scope đã chuẩn hóa      | Không nhận                        |
| Enrollment/lớp/học phần       | Chủ sở hữu            | Chỉ nhận ID và nguồn được phép   | Không nhận                        |
| Phê duyệt học liệu            | Chủ sở hữu            | Chỉ index phiên bản đã duyệt     | Không nhận                        |
| Ingestion/OCR/chunking        | Theo dõi và cấp nguồn | Chủ sở hữu pipeline              | Không nhận                        |
| Retrieval/reranking           | Không thực hiện       | Chủ sở hữu                       | Không thực hiện                   |
| Sinh câu trả lời              | Điều phối             | Chuẩn hóa prompt và gọi provider | Thực hiện generation              |
| Citation validation           | Quyết định cuối       | Tạo citation có provenance       | Không được tin làm nguồn duy nhất |
| Publication/review            | Chủ sở hữu            | Trả safety/review signal         | Chỉ trả signal nếu có             |
| Audit và retention            | Chủ sở hữu            | Log kỹ thuật đã redaction        | Theo hợp đồng provider            |
| Rate limit người dùng         | Chủ sở hữu            | Rate limit service/worker        | Rate limit provider               |

## 5. Danh tính và phân quyền

### 5.1 Microsoft Entra ID

Backend dùng OIDC Authorization Code Flow + PKCE theo mô hình Backend-for-Frontend:

1. Browser gọi `GET /api/v1/auth/login`.
2. Backend redirect sang Microsoft Entra ID của PTIT.
3. Entra redirect về callback đã đăng ký.
4. Backend xác minh issuer, audience, signature, `exp`, `nonce`, `state`, `tid`.
5. Backend liên kết tài khoản bằng `tid + oid`, không dùng email làm khóa bất biến.
6. Vai trò và enrollment lấy từ App Roles hoặc hệ thống SIS/PTIT.
7. Backend tạo session nội bộ và trả cookie `HttpOnly; Secure; SameSite=Lax`.

### 5.2 Dữ liệu tuyệt đối không gửi sang RAG/model

- Cookie hoặc session token.
- Microsoft access token/refresh token.
- Email, họ tên, số điện thoại hoặc mã sinh viên nếu không có lý do nghiệp vụ đã được phê duyệt.
- Dữ liệu lớp khác hoặc danh sách sinh viên.
- Toàn bộ tài liệu khi chỉ cần một số chunk đã truy xuất.

RAG có thể nhận `userRef` dạng opaque/pseudonymous nếu cần quota hoặc trace, nhưng không được ánh xạ
ngược về người dùng nếu không truy cập Backend PTIT.

## 6. Chính sách hiển thị câu trả lời

Ba nhóm trạng thái phải được lưu độc lập:

```ts
type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
type Outcome = 'answered' | 'abstained' | 'blocked'
type PublicationStatus = 'withheld' | 'provisional' | 'published'
type ReviewStatus = 'not_required' | 'pending' | 'approved' | 'rejected' | 'needs_revision'
```

| Điều kiện                                  | Outcome     | Publication   | Hành vi UI                        |
| ------------------------------------------ | ----------- | ------------- | --------------------------------- |
| Đúng scope, citation hợp lệ, safety allow  | `answered`  | `provisional` | Hiển thị ngay với nhãn AI         |
| Giảng viên đã xác nhận                     | `answered`  | `published`   | Hiển thị nhãn đã xác nhận         |
| Không đủ nguồn                             | `abstained` | `published`   | Hiển thị thông báo chưa đủ căn cứ |
| Citation không hợp lệ/ngoài scope          | `abstained` | `withheld`    | Không hiển thị output model       |
| Safety block/prompt injection nghiêm trọng | `blocked`   | `withheld`    | Hiển thị thông báo an toàn        |
| Provider lỗi/timeout                       | Không có    | `withheld`    | Cho retry hoặc chuyển giảng viên  |

`provisional` không có nghĩa là chưa kiểm tra. Output chỉ được provisional sau khi qua schema,
source scope, citation locator, safety và render-safety validation.

## 7. API Browser → Backend PTIT

API dùng cùng origin với frontend và có prefix `/api/v1`.

### 7.1 Tạo yêu cầu chat

```http
POST /api/v1/chat/requests
Content-Type: application/json
Idempotency-Key: <uuid-v4>
X-Request-ID: <uuid-v4>
```

```json
{
  "conversationId": "conv_01...",
  "clientMessageId": "msg_client_01...",
  "content": "Phân tích mối quan hệ giữa vật chất và ý thức.",
  "subjectId": "subject_philosophy",
  "classId": "class_2026_01",
  "lessonId": "lesson_02_optional"
}
```

Giới hạn đề xuất:

- `content`: 10–4.000 ký tự Unicode, tối đa 16 KB UTF-8.
- Một `clientMessageId` chỉ được dùng cho một nội dung.
- `subjectId`, `classId`, `lessonId` phải được Backend kiểm tra bằng session/enrollment.
- Không nhận `studentId` từ browser; luôn lấy từ session.

Response:

```http
HTTP/1.1 202 Accepted
Location: /api/v1/chat/requests/ragreq_01...
Retry-After: 1
```

```json
{
  "data": {
    "requestId": "ragreq_01...",
    "questionId": "question_01...",
    "conversationId": "conv_01...",
    "status": "queued",
    "eventsUrl": "/api/v1/chat/requests/ragreq_01.../events",
    "statusUrl": "/api/v1/chat/requests/ragreq_01..."
  }
}
```

Idempotency:

- Unique constraint: `(student_id, idempotency_key)`.
- Retry cùng key và cùng payload trả lại request cũ.
- Cùng key nhưng payload khác trả `409 IDEMPOTENCY_CONFLICT`.

### 7.2 Theo dõi trạng thái

```http
GET /api/v1/chat/requests/:requestId
```

Trả trạng thái hiện tại và terminal response nếu đã hoàn thành.

### 7.3 Streaming qua SSE

```http
GET /api/v1/chat/requests/:requestId/events
Accept: text/event-stream
Last-Event-ID: <optional>
```

Event types:

| Event        | Ý nghĩa                                           |
| ------------ | ------------------------------------------------- |
| `status`     | `queued`, `processing` hoặc thay đổi trạng thái   |
| `delta`      | Phần text tạm thời; chưa được coi là kết quả cuối |
| `citation`   | Citation tạm thời đã parse                        |
| `moderation` | Safety/review signal                              |
| `done`       | Terminal response đã validate và persist          |
| `error`      | Lỗi ổn định, có `retryable`                       |

Mỗi event có `id` tăng đơn điệu. Khi reconnect, client gửi `Last-Event-ID`. Polling endpoint là fallback
nếu mạng/proxy không hỗ trợ SSE tốt.

### 7.4 Hủy yêu cầu

```http
POST /api/v1/chat/requests/:requestId/cancel
```

Chỉ hủy được job của chính người dùng. Hủy là idempotent. Nếu provider không hỗ trợ cancel, Backend
đánh dấu logical cancellation và không công bố kết quả trả về muộn.

### 7.5 Feedback

```http
POST /api/v1/chat/responses/:responseId/feedback
```

```json
{
  "rating": "helpful",
  "reasonCodes": ["clear", "correct_citation"],
  "comment": "Tùy chọn, tối đa 1.000 ký tự"
}
```

`rating`: `helpful | not_helpful`. Feedback không tự động thay đổi publication status.

## 8. Contract Backend PTIT → RAG service

```http
POST /internal/v1/answers
Authorization: Bearer <service-token>
Idempotency-Key: <same-logical-request-key>
X-Request-ID: <request-id>
traceparent: <W3C trace context>
Content-Type: application/json
```

Ưu tiên mTLS hoặc OAuth2 client credentials/short-lived service token. Không dùng một API key tĩnh
không có rotation trong production.

### 8.1 Request schema tối thiểu

```json
{
  "schemaVersion": "1.0",
  "requestId": "ragreq_01...",
  "tenantId": "ptit",
  "query": {
    "text": "Phân tích mối quan hệ giữa vật chất và ý thức.",
    "language": "vi-VN"
  },
  "conversation": {
    "id": "conv_01...",
    "messageId": "msg_01...",
    "history": [{ "role": "user", "content": "Câu hỏi trước đã được giới hạn và làm sạch" }]
  },
  "scope": {
    "subjectId": "subject_philosophy",
    "classId": "class_2026_01",
    "lessonId": "lesson_02_optional",
    "allowedMaterialVersionIds": ["mv_01", "mv_02"]
  },
  "policy": {
    "publicationMode": "risk_based",
    "citationRequired": true,
    "maxOutputTokens": 600,
    "safetyPolicyVersion": "ptit-safety-v1"
  },
  "limits": {
    "deadlineMs": 30000,
    "maxRetrievedChunks": 8,
    "maxContextTokens": 6000
  },
  "client": {
    "name": "ptit-chinh-tri-backend",
    "version": "1.0.0"
  }
}
```

Quy tắc:

- RAG chỉ được retrieve trong `allowedMaterialVersionIds`.
- Nếu danh sách rỗng, RAG phải `abstained` hoặc trả `SOURCE_NOT_INDEXED`; không tự tìm web.
- History phải được giới hạn số message/token bằng quy tắc xác định trước.
- Không gửi chain-of-thought hoặc yêu cầu provider trả chain-of-thought.
- `deadlineMs` là deadline toàn cục, không phải timeout cho từng retry.

### 8.2 Terminal response schema

```json
{
  "schemaVersion": "1.0",
  "requestId": "ragreq_01...",
  "providerJobId": "provider_job_optional",
  "outcome": "answered",
  "answer": {
    "text": "Nội dung câu trả lời...",
    "language": "vi-VN",
    "finishReason": "stop"
  },
  "citations": [
    {
      "citationId": "citation_01...",
      "materialId": "material_01",
      "materialVersionId": "mv_01",
      "chunkId": "chunk_01",
      "pageNumber": 42,
      "section": "Chương 2",
      "quote": "Trích đoạn nguyên văn ngắn...",
      "rank": 1,
      "retrievalScore": 0.82,
      "rerankScore": 0.91,
      "chunkSha256": "hex-sha256"
    }
  ],
  "safety": {
    "decision": "allow",
    "categoryCodes": [],
    "reasonCodes": [],
    "policyVersion": "ptit-safety-v1"
  },
  "review": {
    "required": false,
    "priority": "sample",
    "reasonCodes": []
  },
  "provenance": {
    "modelProvider": "TBD",
    "modelId": "TBD",
    "modelRevision": "TBD",
    "promptVersion": "ptit-politics-v1",
    "embeddingModel": "TBD",
    "retrieverVersion": "retriever-v1",
    "rerankerVersion": "TBD",
    "indexVersion": "index_2026_01"
  },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "retrievedChunks": 0
  },
  "timingMs": {
    "queue": 0,
    "retrieval": 0,
    "firstToken": 0,
    "generation": 0,
    "total": 0
  }
}
```

Enums:

- `outcome`: `answered | abstained | blocked`.
- `finishReason`: `stop | length | safety`.
- `safety.decision`: `allow | review | block`.
- `review.priority`: `high | medium | sample`.

`confidence` không bắt buộc. Nếu đội Chatbot cung cấp confidence thì phải giao miền giá trị, cách
calibration, evaluator/dataset version và ngưỡng sử dụng. Không dùng số confidence không có định nghĩa
để quyết định publication.

### 8.3 Backend validation sau khi nhận response

Backend hoặc shared validation library phải kiểm tra:

1. `requestId` khớp job đang xử lý.
2. Response đúng JSON Schema và không vượt giới hạn kích thước.
3. `materialVersionId` nằm trong allowlist đã gửi.
4. Tài liệu vẫn ở trạng thái approved/effective.
5. `chunkId`, page, checksum và quote tồn tại trong index/source manifest.
6. Không có URL tùy ý hoặc HTML/script không được phép trong answer/citation.
7. `blocked` và `abstained` không được chuyển thành lỗi 5xx.
8. Terminal response chỉ được persist một lần; response trùng được xử lý idempotent.

Nếu validation thất bại, lưu `MALFORMED_PROVIDER_RESPONSE` hoặc `INVALID_CITATION`, đặt publication
`withheld` và đưa job vào hàng đợi kỹ thuật/giảng viên; không tự tạo citation thay thế.

## 9. Contract ingestion học liệu

### 9.1 Manifest đầu vào

```json
{
  "schemaVersion": "1.0",
  "materialId": "material_01",
  "materialVersionId": "mv_01",
  "subjectId": "subject_philosophy",
  "title": "Giáo trình Triết học Mác - Lênin",
  "author": "TBD",
  "year": 2026,
  "language": "vi-VN",
  "mimeType": "application/pdf",
  "pageCount": 320,
  "storageKey": "approved/subject_philosophy/mv_01.pdf",
  "sha256": "hex-sha256",
  "approval": {
    "status": "approved",
    "approvedBy": "opaque-user-id",
    "approvedAt": "2026-01-01T00:00:00.000Z"
  },
  "effectiveAt": "2026-01-01T00:00:00.000Z",
  "retiredAt": null
}
```

### 9.2 Trạng thái ingestion

```ts
type IngestionStatus =
  | 'queued'
  | 'extracting'
  | 'ocr_processing'
  | 'chunking'
  | 'embedding'
  | 'indexed'
  | 'partially_failed'
  | 'failed'
  | 'retired'
```

Kết quả ingestion phải có job ID, page counts, OCR engine/version, chunking version, số chunk,
embedding model/dimension, index version, danh sách trang lỗi, error codes và timestamps.

### 9.3 Quy tắc nguồn

- Chỉ index tài liệu `approved`.
- Mỗi version là bất biến; cập nhật file tạo version mới.
- `chunkId` ổn định trong cùng một material version.
- Citation cũ còn resolve được trong thời gian retention đã cam kết.
- Retire/delete có tombstone và không làm citation lịch sử trỏ sai nội dung.
- Mọi chunk giữ material/version/page/section/offset/checksum.
- PDF scan tiếng Việt có tiêu chí OCR accuracy và danh sách trang thất bại.

## 10. Error contract

```json
{
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "Hệ thống trợ giảng đang phản hồi chậm. Vui lòng thử lại.",
    "retryable": true,
    "requestId": "ragreq_01...",
    "details": {}
  }
}
```

| Code                          |    HTTP | Retry         | Hành vi                                |
| ----------------------------- | ------: | ------------- | -------------------------------------- |
| `VALIDATION`                  |     400 | Không         | Sửa request                            |
| `UNAUTHENTICATED`             |     401 | Không         | Đăng nhập lại                          |
| `FORBIDDEN_SCOPE`             |     403 | Không         | Không lộ dữ liệu ngoài scope           |
| `NOT_FOUND`                   |     404 | Không         | Resource không tồn tại/không nhìn thấy |
| `IDEMPOTENCY_CONFLICT`        |     409 | Không         | Dùng key mới hoặc payload cũ           |
| `SOURCE_NOT_INDEXED`          |     409 | Không tự động | Chờ ingestion/escalate                 |
| `INVALID_CITATION`            |     422 | Không         | Withhold và kiểm tra kỹ thuật          |
| `SAFETY_BLOCKED`              |     422 | Không         | Hiển thị trạng thái blocked            |
| `RATE_LIMITED`                |     429 | Có            | Tôn trọng `Retry-After`                |
| `OVER_CAPACITY`               | 429/503 | Có            | Queue hoặc retry có jitter             |
| `PROVIDER_TIMEOUT`            |     504 | Có            | Retry cùng idempotency key             |
| `PROVIDER_UNAVAILABLE`        |     503 | Có            | Circuit breaker/fallback               |
| `MALFORMED_PROVIDER_RESPONSE` |     502 | Có giới hạn   | Không công bố output                   |
| `CANCELLED`                   |     409 | Không         | Job đã hủy                             |
| `INTERNAL`                    |     500 | Có giới hạn   | Log request ID, không lộ stack         |

Retry policy:

- Chỉ retry network error, 429, 502, 503, 504.
- Không retry validation, auth, forbidden, safety, abstention.
- Tối đa 3 attempt với exponential backoff + jitter.
- Luôn dùng cùng logical request/idempotency key.
- Tôn trọng `Retry-After` nhưng không vượt global deadline.
- Hết attempt chuyển dead-letter/technical review; không loop vô hạn.

## 11. State machine và queue

```text
queued --> processing --> succeeded
  |           |              |
  |           |              +--> answered / abstained / blocked
  |           +--> failed
  +--> cancelled
```

Job worker cần lease owner, lease expiry, heartbeat, attempt/max attempts, provider job ID, deadline,
typed error và dead-letter state.

Worker crash sau khi provider thành công nhưng trước DB commit phải chạy lại mà không tạo hai response.
Nếu queue không hỗ trợ exactly-once, hệ thống đạt effectively-once bằng idempotency và unique constraint.

## 12. Database production cần bổ sung

| Bảng/nhóm        | Trường quan trọng                                          |
| ---------------- | ---------------------------------------------------------- |
| `users`          | Entra `tenant_id`, `object_id`, role, trạng thái           |
| `conversations`  | owner, subject/class scope, created/updated/archived       |
| `messages`       | conversation, role, content, publication, sequence         |
| `rag_requests`   | idempotency, class/enrollment, job status, deadline        |
| `rag_attempts`   | attempt, provider job, latency, error, timestamps          |
| `rag_responses`  | outcome, publication, review, provenance, token usage      |
| `rag_citations`  | document/version/chunk/page/quote/checksum/scores          |
| `rag_reviews`    | reviewer, action, content diff, reason codes               |
| `feedback`       | response, rating, reason codes, comment                    |
| `outbox_events`  | aggregate, event type, payload, published time             |
| `ingestion_jobs` | document version, status, counts, index version            |
| `audit_logs`     | actor, action, target, request/trace ID, redacted metadata |

Constraints/index tối thiểu:

- Unique `(student_id, idempotency_key)`.
- Unique terminal response theo `rag_request_id`.
- Index queue theo `(status, available_at, created_at)`.
- Index review theo `(review_status, priority, created_at)`.
- Index conversation message theo `(conversation_id, sequence)`.
- Index question theo `(class_id, student_id, created_at)`.
- Index session expiry và cleanup job.
- Không filter queue/review bằng cách tải toàn bộ rows về JavaScript.

## 13. Capacity và giới hạn ban đầu

| Chỉ số                     |                             Target |
| -------------------------- | ---------------------------------: |
| Session đồng thời          |                              3.000 |
| API steady                 |                        100–200 RPS |
| API burst                  |             500 RPS trong 1–5 phút |
| Chat admission bình thường |                   2–5 request/giây |
| Chat peak                  |                  5–10 request/giây |
| SSE đồng thời              |                            150–300 |
| Một người dùng             |      Tối đa 1 generation đang chạy |
| Chat quota ban đầu         | 10–20 câu/giờ/người, cấu hình được |
| Query                      |                 Tối đa 4.000 ký tự |
| Output                     |     Mặc định 600, tối đa 800 token |
| Tổng deadline              |             30 giây, cấu hình được |

```text
active generation ~= chat request/giây * thời gian trả lời trung bình
output token/phút ~= chat request/giây * 60 * output token trung bình
input token/phút ~= chat request/giây * 60 * context token trung bình
```

Với 10 chat/giây, 2.000 input token và 500 output token mỗi request, provider cần khoảng 1.200.000
input token/phút và 300.000 output token/phút. Quota này phải được xác nhận bằng văn bản.

## 14. SLO và quality KPI cho pilot

### Service SLO

| SLO                         |                       Mục tiêu pilot |
| --------------------------- | -----------------------------------: |
| Chat admission availability |                          99,9%/tháng |
| Admission p95               |                              ≤300 ms |
| Admission p99               |                              ≤750 ms |
| Queue start p95 steady      |                              ≤1 giây |
| Queue start p95 burst       |                              ≤3 giây |
| TTFT p95                    |                            ≤2,5 giây |
| Terminal answer p95         |                             ≤12 giây |
| Terminal answer p99         |                             ≤25 giây |
| Technical completion        | ≥99,5%, không tính blocked/abstained |
| Publication state visible   |      p95 ≤2 giây sau terminal result |

Latency chỉ có ý nghĩa khi ghi rõ token profile; mặc định tài liệu này dùng tối đa 2.000 input/context
token và 600 output token.

### Quality KPI

- Citation structural validity: 100%.
- Source/class scope violation: 0.
- Groundedness/citation entailment: mục tiêu 95–98% trên golden set có giảng viên gắn nhãn.
- Tỷ lệ abstain và block.
- Tỷ lệ giảng viên approve/edit/reject.
- Retrieval recall@k và citation precision/coverage.
- Helpful/not-helpful từ sinh viên.
- Chi phí trên request/ngày/tháng.

## 15. Observability

Mọi tầng truyền `requestId`, `providerJobId` nếu có, W3C `traceparent`, `conversationId` dạng opaque và
model/index/prompt versions.

Metrics bắt buộc:

- Admission/completion theo status/outcome/model/index.
- Queue depth và oldest job age.
- Retrieval, TTFT, generation, total latency p50/p95/p99.
- Token/request, token/giây và provider quota usage.
- 429/5xx/timeout/retry/circuit-open.
- Invalid citation, citation coverage, abstain, block.
- Review approve/edit/reject và time-to-review.
- Cost/request và cost/day.

Privacy:

- Không dùng user ID, email hoặc question text làm metric label.
- Prompt/output không log mặc định.
- Debug capture phải sampling, redaction và retention ngắn có phê duyệt.
- Không lưu chain-of-thought.

Alert tối thiểu:

- Error rate >2% trong 5 phút.
- Queue oldest age vượt SLO.
- Provider 429/5xx tăng đột biến.
- Citation validation failure >0.
- Worker heartbeat mất.
- PostgreSQL connection pool saturation.
- Disk/object storage/vector index gần đầy.

## 16. Security và privacy checklist

- [ ] OIDC issuer/audience/signature/nonce/state được kiểm tra.
- [ ] RBAC lấy từ App Roles/SIS, không suy luận chỉ bằng domain email.
- [ ] mTLS hoặc short-lived service auth giữa Backend và RAG.
- [ ] Secrets nằm trong secret manager, không commit `.env`.
- [ ] Rotation key/certificate có runbook và kiểm thử.
- [ ] Rate limit theo user, IP, lớp và toàn hệ thống.
- [ ] Input, history, context và response có byte/token limit.
- [ ] Prompt injection trong query và retrieved document được kiểm thử.
- [ ] Citation URL/path không cho phép open redirect hoặc script scheme.
- [ ] Markdown/HTML output được sanitize trước render.
- [ ] Scope được Backend kiểm tra trước và sau RAG.
- [ ] Model provider cam kết không dùng dữ liệu PTIT để train.
- [ ] Có retention/delete/export policy cho chat, raw payload và audit.
- [ ] Có incident notification time và đầu mối escalation.
- [ ] Có pentest trước production và định kỳ.

## 17. Cấu hình môi trường cần thống nhất

```text
APP_ENV
PUBLIC_BASE_URL
DATABASE_URL
REDIS_URL
QUEUE_URL
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY       # secret manager
OBJECT_STORAGE_SECRET_KEY       # secret manager
ENTRA_TENANT_ID
ENTRA_CLIENT_ID
ENTRA_CLIENT_SECRET             # hoặc certificate trong secret manager
ENTRA_REDIRECT_URI
RAG_SERVICE_BASE_URL
RAG_SERVICE_AUDIENCE
RAG_SERVICE_CLIENT_ID
RAG_SERVICE_CLIENT_SECRET       # nếu không dùng mTLS
MODEL_PROVIDER
MODEL_API_BASE_URL
MODEL_API_KEY                   # RAG secret manager; Backend web không cần biết
MODEL_ID
EMBEDDING_MODEL_ID
RERANKER_MODEL_ID
VECTOR_INDEX_NAME
CHAT_GLOBAL_DEADLINE_MS
CHAT_MAX_OUTPUT_TOKENS
CHAT_USER_CONCURRENCY
CHAT_USER_HOURLY_QUOTA
CHAT_REVIEW_SAMPLE_RATE
OTEL_EXPORTER_OTLP_ENDPOINT
```

Mỗi môi trường `dev`, `staging`, `production` có credential và database/index tách biệt. Không sử dụng
dữ liệu sinh viên thật trong dev.

## 18. Gói bàn giao đội Chatbot/RAG phải cung cấp

### API và mã nguồn

- [ ] OpenAPI 3.1/JSON Schema hoặc gRPC/AsyncAPI tương đương.
- [ ] Sample request/response cho success, abstain, block và từng lỗi.
- [ ] Provider stub chạy được trong CI.
- [ ] Docker image/Dockerfile và manifest triển khai.
- [ ] Danh sách environment variables và secrets.
- [ ] Versioning/deprecation policy.
- [ ] Health, readiness và metrics endpoints.

### Model và retrieval

- [ ] Model provider, model ID/revision và context/token limits.
- [ ] Prompt version và quy trình rollout/rollback.
- [ ] Embedding/reranker model/version/dimension.
- [ ] Chunking/index version.
- [ ] Benchmark tiếng Việt theo concurrency 1/10/25/50.
- [ ] QPS, burst, token/minute và queue depth tối đa.
- [ ] Safety policy/category/reason codes.
- [ ] Citation schema và validation library hoặc fixtures.

### Ingestion

- [ ] File/page/byte limits và MIME hỗ trợ.
- [ ] OCR engine/version và tiêu chí cho PDF scan.
- [ ] Update/delete/reindex/tombstone semantics.
- [ ] Job status/error catalog.
- [ ] Source checksum và chunk identity.
- [ ] Reindex SLA và khả năng resolve citation cũ.

### Vận hành

- [ ] Bill of materials CPU/RAM/GPU/disk từng service.
- [ ] Runbook overload, timeout, quota exhaustion và provider outage.
- [ ] Runbook model/index rollback.
- [ ] Runbook stuck job, DLQ replay và secret rotation.
- [ ] Dashboard/alerts mẫu.
- [ ] RPO/RTO, backup/restore và disaster recovery test.
- [ ] Contact, escalation và incident response time.

## 19. Gói bàn giao Backend PTIT phải cung cấp

- [ ] OpenAPI của Browser API và internal RAG callback/job API.
- [ ] Entra tenant/client/claims contract đã redaction.
- [ ] User/class/subject/lesson/material ID formats.
- [ ] Enrollment và source authorization rules.
- [ ] Material manifest và sample approved documents.
- [ ] Allowed source version API hoặc snapshot contract.
- [ ] Publication/review policy và sample rate.
- [ ] Error envelope, retry và idempotency semantics.
- [ ] Staging endpoint, test accounts và test classes.
- [ ] SLO/load profiles và retention policy.
- [ ] Consumer contract tests chạy trong CI.

## 20. Bộ test nghiệm thu chung

### Functional

- Query đúng scope, một và nhiều citation.
- Câu hỏi mơ hồ, không có nguồn, sai môn, version cũ.
- Multi-turn history và history truncation.
- PDF text, PDF scan/OCR, ký tự Unicode dài.
- Cancel và reconnect SSE.

### Security

- Sinh viên truy cập nguồn/lớp của người khác.
- Prompt injection trong câu hỏi và trong tài liệu.
- Citation giả, path/URL injection.
- Output XSS/Markdown độc hại.
- PII/secrets trong prompt/log.
- Replay request và duplicate idempotency key.

### Resilience

- Provider trả 429/5xx/timeout.
- Provider trả JSON sai schema hoặc response quá lớn.
- Citation sai/ngoài allowlist.
- Stream bị ngắt và reconnect.
- Worker crash trước/sau provider response.
- Webhook/event trùng hoặc sai thứ tự.
- Vector index không khả dụng.
- Queue đầy và recovery sau burst.

### Load

- 1.000 session steady.
- 3.000 session steady.
- 500 API RPS burst trong 1–5 phút.
- Chat 2/5/10 request mỗi giây.
- 150/300 SSE connection đồng thời.
- Soak test tối thiểu 60 phút.
- Scale/restart một API hoặc worker trong lúc test.

### Golden quality set

Bắt đầu với 100–200 câu tiếng Việt do giảng viên gắn nhãn, bao phủ toàn bộ học phần:

- Answerable/không answerable.
- Source version/page/quote kỳ vọng.
- Risk/safety label.
- Câu hỏi gây nhiễu hoặc prompt injection.
- Blind holdout không dùng để tinh chỉnh prompt.

## 21. Definition of Done

- [ ] OpenAPI/JSON Schema được hai đội ký xác nhận và contract tests pass.
- [ ] Browser không gọi trực tiếp RAG/model.
- [ ] Idempotency được chứng minh bằng retry/duplicate tests.
- [ ] Không có citation ngoài source allowlist trong golden/security tests.
- [ ] Queue/worker retry, DLQ và recovery được kiểm thử.
- [ ] SSO, RBAC và class/source isolation pass pentest case.
- [ ] Metrics, trace, logs và alert hiển thị request end-to-end.
- [ ] Load test đạt target hoặc có capacity plan được phê duyệt.
- [ ] Backup/restore và rollback model/index được diễn tập.
- [ ] Provider data retention/no-training được xác nhận.
- [ ] Runbooks và contact escalation được bàn giao.

## 22. Các mục còn TBD trước khi khóa contract

| Mục                   | Owner đề xuất | Deadline | Giá trị cần điền                    |
| --------------------- | ------------- | -------- | ----------------------------------- |
| Model API/provider    | Chatbot/PTIT  | TBD      | Provider, model, quota, retention   |
| Quy mô corpus         | PTIT học liệu | TBD      | File, trang, GB, tỷ lệ scan         |
| Embedding model       | Chatbot/RAG   | TBD      | Model, dimension, benchmark         |
| Reranker              | Chatbot/RAG   | TBD      | Model hoặc xác nhận không dùng      |
| Vector database       | Backend + RAG | TBD      | pgvector/Qdrant/khác                |
| Internal service auth | Hạ tầng       | TBD      | mTLS hoặc OAuth2 client credentials |
| Chat retention        | PTIT          | TBD      | Conversation/raw payload/audit TTL  |
| Review sample rate    | Giảng viên    | TBD      | Phần trăm và rule theo rủi ro       |
| Hạ tầng triển khai    | Hạ tầng       | TBD      | VM/on-prem/cloud, HA topology       |
| Hostname và firewall  | Hạ tầng       | TBD      | Dev/staging/prod endpoints          |
| SLO chính thức        | Hai đội       | TBD      | Token profile và latency target     |

## 23. Biên bản sign-off

| Vai trò             | Họ tên | Ngày | Phiên bản | Xác nhận |
| ------------------- | ------ | ---- | --------- | -------- |
| Backend PTIT lead   |        |      | `1.0`     |          |
| Chatbot/RAG lead    |        |      | `1.0`     |          |
| Hạ tầng/DevOps      |        |      | `1.0`     |          |
| An toàn thông tin   |        |      | `1.0`     |          |
| Đại diện giảng viên |        |      | `1.0`     |          |

Mọi thay đổi breaking sau sign-off phải tăng major version của contract và có kế hoạch migration/deprecation.
