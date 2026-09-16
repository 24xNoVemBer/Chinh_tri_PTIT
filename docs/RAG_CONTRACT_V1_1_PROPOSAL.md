# Đề xuất contract RAG 1.1

Ngày: 14/09/2026. Trạng thái: **đề xuất, chưa kích hoạt trong Node hoặc MBA_API**.

## Mục tiêu

Contract 1.0 tiếp tục là contract chạy thật của pilot. Vì schema 1.0 dùng
`additionalProperties: false`, không thêm ngầm academic term hay index version vào payload 1.0.
Version 1.1 được đề xuất để hai phía xác nhận cùng scope/index trước retrieval và để audit có thể
đối chiếu chính xác câu trả lời với trạng thái nguồn tại thời điểm xử lý.

## Thay đổi request

Giữ toàn bộ trường 1.0 và thay `schemaVersion` thành `1.1`. Bổ sung bắt buộc trong `scope`:

```json
{
  "academicTermId": "term-2026-1",
  "classId": "class1",
  "indexVersion": "idx-sub1-term-2026-1-v3"
}
```

- `classId` là một lớp duy nhất; bỏ `classIds` để không còn hai cách biểu diễn cùng ý nghĩa.
- `academicTermId` do Node lấy từ lớp đang active, không nhận quyền hạn từ browser.
- `indexVersion` do Node lấy từ registry có trạng thái `ready`, khớp tenant/môn/học kỳ/material versions.
- `allowedMaterialVersionIds` vẫn bắt buộc. Đây là allow-list dữ liệu, không được thay bằng collection name.
- RAG service phải kiểm tra mọi chunk theo cả index version và allow-list trước khi tạo context.

## Thay đổi terminal answer

Giữ `provenance.indexVersion` và bổ sung `appliedScope` bắt buộc:

```json
{
  "tenantId": "ptit",
  "subjectId": "sub1",
  "academicTermId": "term-2026-1",
  "classId": "class1",
  "indexVersion": "idx-sub1-term-2026-1-v3",
  "allowedMaterialVersionIds": ["mv1"],
  "scopeSha256": "64-lowercase-hex"
}
```

`scopeSha256` là SHA-256 của JSON canonical gồm các field scope ở trên và allow-list đã sort. Node tự
tính lại rồi so sánh; không dùng hash thay cho kiểm tra citation từng phần tử. Citation vẫn bắt buộc có
material/version/chunk ID/hash và chỉ có page khi parser thật sự cung cấp.

## Capability negotiation

`/internal/v1/capabilities` giữ envelope hiện tại và dùng:

- `supportedSchemaVersions`: ví dụ `["1.0", "1.1"]` trong giai đoạn chuyển tiếp;
- `features`: đề xuất object gồm `multiTurn`, `streaming`, `durableIdempotency`;
- không công bố danh sách tài liệu người dùng được phép truy cập tại endpoint capability;
- readiness chỉ báo service/index runtime sẵn sàng, không gọi model tính phí.

Node chỉ gửi 1.1 khi service quảng bá 1.1. Không tự downgrade request 1.1 sang 1.0. Trong rollout hai
version, response phải cùng version với request.

## Namespace ID

| ID                             | Nơi tạo          | Ý nghĩa                                               |
| ------------------------------ | ---------------- | ----------------------------------------------------- |
| `question.id`                  | Node DB          | Câu hỏi nghiệp vụ hiển thị cho sinh viên/giảng viên   |
| `rag_requests.id`              | Node DB          | Logical request bền vững và trạng thái xử lý          |
| `requestId` / `X-Request-ID`   | Node             | Correlation UUID xuyên HTTP/log, không thay DB ID     |
| `providerJobId`                | RAG service      | Job/inference phía provider, không dùng để phân quyền |
| `conversationId` / `messageId` | Node ledger ở P5 | Hội thoại và logical message để idempotency           |

## Lỗi tối thiểu cần thống nhất

- `VALIDATION` (400): payload/version/body limit sai;
- `UNAUTHORIZED` (401): service token sai;
- `SCOPE_FORBIDDEN` (403): scope không được phép;
- `SOURCE_NOT_INDEXED` (409): không có đúng index ready, không fallback latest;
- `IDEMPOTENCY_CONFLICT` (409): cùng key nhưng body canonical khác;
- `INVALID_CITATION` (502): citation ngoài scope hoặc không kiểm chứng được;
- `PROVIDER_AUTH_FAILED`, `PROVIDER_QUOTA_EXCEEDED`, `PROVIDER_RATE_LIMITED`,
  `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`;
- `PERSISTENCE_FAILED` và `REQUEST_INTERRUPTED` thuộc lifecycle Node, không biến thành câu trả lời mẫu.

## Trình tự triển khai

1. Tạo JSON Schema/example 1.1 và contract tests độc lập; giữ registry mặc định ở 1.0.
2. Tạo index registry/manifest ở P3 và seed fixture index ở trạng thái `ready`.
3. MBA_API hỗ trợ đọc 1.1, lọc Qdrant theo applied scope, trả `appliedScope` và vẫn nhận 1.0.
4. Node thêm negotiation, tự tạo scope 1.1, kiểm tra response và lưu scope hash/index version.
5. Chạy test chéo 1.0/1.1, sai term/index, revoked source, unknown version và downgrade bị cấm.
6. Chỉ chuyển mặc định sang 1.1 sau khi fixture, ingestion và router thật cùng đạt; sau thời gian chuyển
   tiếp mới lên kế hoạch bỏ 1.0.

Chưa tạo schema 1.1 chạy được ở mốc này để tránh một contract “xanh trên giấy” nhưng MBA_API chưa có
router/index registry tương ứng.
