# Baseline retrieval RAG Triết học — v1

## Kết luận

BM25 hiện tìm tốt câu hỏi trực tiếp nhưng chưa đủ an toàn để dùng độc lập: top 5 đạt 95% trên
nhóm trực tiếp, trong khi paraphrase đạt 70%, câu nhiều ý đạt 75% và abstention là 0/12.
Không áp một threshold BM25 mới lên runtime vì phân bố điểm của câu hợp lệ và câu ngoài phạm vi
chồng lấn mạnh. Thay đổi threshold lúc này sẽ đổi lỗi trả nhầm nguồn thành lỗi từ chối câu đúng.

Đây là baseline kỹ thuật, không phải điểm đúng/sai học thuật. Bộ câu hỏi và điều kiện từ khóa vẫn
ở trạng thái `draft_unreviewed`, cần giảng viên xác nhận trước khi dùng làm cổng nghiệm thu.

## Phiên bản chạy

- Dataset: `private-triet-hoc-ptit-2021`
- Material version: `mv-triet-hoc-ptit-2021-9bc31657`
- Source SHA-256: `9bc31657a5343e6cfd88bb7c1ed359d48c2c0430a3bb4b22de30ed251628ad1e`
- Chunks SHA-256: `5ee9ee961413e322d996709260edab65e4c1d1ce36aaf55e9d91a945bd82d3b5`
- Eval SHA-256: `e0491488ca53216fed009a7ffac2cf20eb67d101c0d76cc3e87b47599d02827b`
- Index: `idx-triet-hoc-bm25-v1`
- Retriever: `mba-course-rag-bm25-pilot-v1`
- Ngày chạy: 2026-09-16
- Số chunks: 423; số cases: 50

Report máy đầy đủ được giữ private trên server, mode `600`; report trong Git chỉ chứa aggregate và
ID case lỗi, không chứa quote, chunk text hoặc nội dung giáo trình.

## Cấu trúc bộ eval

| Nhóm             | Số case | Mục đích                                                          |
| ---------------- | ------: | ----------------------------------------------------------------- |
| Direct           |      20 | Khái niệm và câu hỏi sát thuật ngữ giáo trình                     |
| Paraphrase       |      10 | Cùng ý nhưng thay cách diễn đạt                                   |
| Multi-part       |       8 | Một câu cần bao phủ nhiều luận điểm                               |
| Out-of-scope     |       8 | Nội dung không thuộc môn, phải abstain                            |
| Prompt injection |       4 | Yêu cầu lộ bí mật/bỏ quy tắc/thao tác hệ thống, phải được từ chối |

Với case cần retrieval, một case đạt khi top-k bao phủ mọi nhóm thuật ngữ kỳ vọng. Đây chỉ là
keyword proxy độc lập với câu trả lời, không chứng minh đoạn tìm được đủ căn cứ học thuật.

## Kết quả

| Nhóm             | Top 1 | Top 3 | Top 5 / Pass | Case chưa đạt                   |
| ---------------- | ----: | ----: | -----------: | ------------------------------- |
| Direct           |   40% |   85% |          95% | `direct-07`                     |
| Paraphrase       |   40% |   50% |          70% | `paraphrase-03`, `-06`, `-10`   |
| Multi-part       |   50% |   75% |          75% | `multi-01`, `multi-04`          |
| Out-of-scope     |     — |     — |           0% | `outside-01` đến `outside-08`   |
| Prompt injection |     — |     — |           0% | `security-01` đến `security-04` |

Tổng cộng 32/50 case đạt theo rule hiện tại. Tỷ lệ tổng không được dùng làm KPI duy nhất vì các
nhóm có mục tiêu khác nhau.

## Phân tích threshold

Phân bố `maxScore`:

- Câu cần retrieve: min `4.532477`, median `21.204894`, max `39.190029`.
- Câu cần abstain: min `7.354793`, median `12.175442`, max `17.465860`.

| Threshold | Retrieval pass | Abstention | Balanced score |
| --------: | -------------: | ---------: | -------------: |
|         0 |         84.21% |         0% |         42.11% |
|         5 |         81.58% |         0% |         40.79% |
|        10 |         78.95% |     33.33% |         56.14% |
|        15 |         65.79% |     66.67% |         66.23% |
|        20 |         47.37% |       100% |         73.68% |

Điểm cân bằng tốt nhất quan sát trên chính tập draft là threshold `17.465860`: abstention 100%
nhưng retrieval pass chỉ 55.26%. Không sử dụng con số này cho production vì chất lượng thấp và
việc chọn threshold trên cùng tập đo sẽ overfit.

## Quyết định và bước kế tiếp

1. Giữ runtime hiện tại ở nhãn pilot riêng, chưa public và chưa bật LLM.
2. Thêm scope/prompt-injection gate trước retrieval. Gate phải được đo riêng, không chỉ dựa vào
   BM25 score; lỗi gate cần trả abstain và không gửi câu hỏi sang model.
3. Thử hybrid retrieval: BM25 + embedding tiếng Việt, hợp nhất bằng RRF; sau đó đo lại đúng eval
   version này. Không thay vector/index cũ tại chỗ, tạo index version mới để rollback.
4. Tập trung vào sáu case retrieval chưa đạt, đặc biệt paraphrase và câu nhiều ý. Không sửa query
   hay expected terms chỉ để làm đẹp điểm; mọi thay đổi eval phải tạo version/hash mới.
5. Nhờ giảng viên review câu hỏi, nhóm thuật ngữ và trang chuẩn. Sau review mới tính Recall@k thật
   và đặt ngưỡng nghiệm thu.

Mục tiêu vòng tiếp theo đề xuất: direct top-5 ≥95%, paraphrase và multi-part top-5 ≥85%,
abstention ≥90%, đồng thời không làm giảm citation integrity hoặc scope isolation.

## Thử nghiệm query gate v1

Đã thử `triet-hoc-domain-gate-v1` trước BM25. Gate chặn trước các pattern prompt injection,
sau đó chỉ cho câu có tín hiệu thuộc miền Triết học vào retrieval. Đây là bộ lọc pilot xác định,
không phải safety classifier tổng quát.

| Chỉ số                         | BM25 thuần | BM25 + gate v1 |
| ------------------------------ | ---------: | -------------: |
| Direct top-5                   |        95% |            95% |
| Paraphrase top-5               |        70% |            70% |
| Multi-part top-5               |        75% |            75% |
| Out-of-scope abstention        |         0% |           100% |
| Prompt-injection abstention    |         0% |           100% |
| Câu hợp lệ được gate chấp nhận |          — |          38/38 |
| Tổng case đạt                  |      32/50 |          44/50 |

Report chi tiết `retrieval-gated-v1.json` được giữ private trên server với mode `600`. Code runtime
đã có feature flag `RAG_QUERY_GATE=domain-v1`; sample dataset tiếp tục dùng `none`. Việc bật flag
trên process đang chạy cần restart đúng session pilot và phải được người vận hành cho phép rõ ràng.

### Khảo sát hybrid embedding

Chưa chạy được hybrid semantic an toàn bằng dependency hiện có:

- Python environment có `numpy` nhưng không có `sentence-transformers` hoặc `scikit-learn`.
- MBA_API hiện chỉ cấu hình OpenAI embeddings; key trước đó không hợp lệ và không được phép gửi
  corpus private ra dịch vụ ngoài trong thử nghiệm này.
- Ollama local chỉ có `qwen3-vl:32b`, capability gồm completion/vision/tools/thinking, không hỗ trợ
  embedding.

Không tự cài package hoặc pull thêm model trên server dùng chung. Để thử hybrid local cần duyệt một
embedding model tiếng Việt/multilingual, dung lượng đĩa/RAM và vị trí cache; index mới phải có version
riêng và không ghi đè BM25 hiện tại.
