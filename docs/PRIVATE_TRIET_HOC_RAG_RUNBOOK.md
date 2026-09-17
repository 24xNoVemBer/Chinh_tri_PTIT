# Pilot RAG với giáo trình Triết học riêng

## Phạm vi

Luồng này nối một PDF có text layer vào chatbot bằng BM25. Có thể chạy baseline extractive hoặc dùng một
model OpenAI-compatible để tổng hợp câu trả lời từ đúng các chunk đã truy xuất. PDF, text đã trích, chunk
và database pilot đều nằm ngoài Git; không có OCR, embedding, Qdrant hay Mongo. Khi bật model từ xa, câu
hỏi và các chunk được chọn sẽ rời server để gửi tới nhà cung cấp. Mọi kết quả bắt buộc mang nhãn pilot
riêng, chưa được giảng viên thẩm định và chờ review.

Nguồn đầu tiên đã xác minh có 167 trang và SHA-256:
`9bc31657a5343e6cfd88bb7c1ed359d48c2c0430a3bb4b22de30ed251628ad1e`.
Nếu hash hoặc số trang khác, dừng ingest; không tự nhận đó là cùng phiên bản tài liệu.

## Biến vận hành

Ví dụ trên Linux, thay đường dẫn nguồn theo máy chạy:

```bash
export PILOT_ROOT=/home/tudd/ptit-rag-pilot
export APP_ROOT="$PILOT_ROOT/Chinh_tri_PTIT"
export MBA_API_PATH="$PILOT_ROOT/ChatBot/MBA_API"
export MBA_PYTHON="$MBA_API_PATH/.venv/bin/python"
export RAG_SOURCE_PDF="$PILOT_ROOT/private/incoming/Backup_GT_CHINH_TRI/Triết học/20260729_075440_BAI GIANG TRIET HOC MAC-LENIN.pdf"
export RAG_CORPUS_MANIFEST="$PILOT_ROOT/private/corpora/triet-hoc-ptit-2021/manifest.json"
```

Không đưa các biến đường dẫn private vào `.env` được commit. Thư mục private nên có mode `700`,
các file corpus mode `600` và chỉ tài khoản vận hành đọc được.

## Ingest xác định và kiểm tra toàn vẹn

Chạy bằng Python environment MBA hiện có; script cần `pdfinfo`, `pdftotext` và `tiktoken`.

```bash
cd "$APP_ROOT"
"$MBA_PYTHON" -B scripts/local-rag/ingest_pdf.py \
  --source "$RAG_SOURCE_PDF" \
  --output "$(dirname "$RAG_CORPUS_MANIFEST")" \
  --expected-sha256 9bc31657a5343e6cfd88bb7c1ed359d48c2c0430a3bb4b22de30ed251628ad1e \
  --expected-pages 167
chmod 700 "$(dirname "$RAG_CORPUS_MANIFEST")"
chmod 600 "$RAG_CORPUS_MANIFEST" "$(dirname "$RAG_CORPUS_MANIFEST")/chunks.jsonl"
```

Pipeline dùng `pdftotext -layout`, chuẩn hóa NFC, nhận diện header/footer lặp, bỏ số trang ở lề,
chia đoạn với tokenizer `cl100k_base` và giữ cả trang PDF lẫn trang in nếu nhận diện được.
`manifest.json` chứa hash PDF, hash toàn bộ `chunks.jsonl`, cấu hình parser/chunker và index version.
Chạy lại với cùng input/cấu hình phải sinh cùng chunk ID và hash.

## Preflight và chạy private pilot

```bash
cd "$APP_ROOT"
export RAG_DATASET=private
export RAG_LOCAL_MODE=extractive
export RAG_QUERY_GATE=domain-v1
export RAG_RETRIEVAL_PROFILE=legacy-v1
npm run local:rag:preflight
npm run build
npm run local:rag
```

Launcher chỉ bind `127.0.0.1:3101` và `127.0.0.1:8787`. Nó dùng
`data/local-rag/private-pilot.sqlite`, tách khỏi cả database ứng dụng và DB fixture mẫu.
Nguồn được whitelist kỹ thuật chỉ trong DB cô lập này để kiểm thử đường quyền; đó không phải phê
duyệt học thuật. Adapter chỉ nhận đúng `tenantId`, môn và `materialVersionId` trong manifest.
`RAG_QUERY_GATE=domain-v1` chặn prompt injection đã biết và câu ngoài miền trước BM25. Có thể rollback
gate bằng `RAG_QUERY_GATE=none`, nhưng chỉ thực hiện khi restart đúng session pilot được cho phép.

`RAG_RETRIEVAL_PROFILE=legacy-v1` giữ đúng giới hạn ba chunk và cách tính ngân sách byte ban đầu.
`top5-v2` cho phép tối đa năm chunk, tôn trọng giới hạn request và dùng `tokenCount` của corpus để tính
ngân sách context. `expanded-v3` giữ cơ chế top 5 và chỉ thêm alias `V.I. Lênin` cho truy vấn có đồng thời
ý định định nghĩa/khái niệm và thuật ngữ `vật chất`; nó không mở rộng câu hỏi khác. Profile mới phải được
đo offline trước khi bật. Có thể rollback về `legacy-v1` bằng restart đúng pilot, không cần reset Git hoặc
thay corpus.

## Chẩn đoán retrieval không gọi model

Công cụ sau chỉ chạy query gate và BM25, luôn báo `providerCalls: 0`. Report chi tiết nằm ngoài Git và
được đặt mode `600` trên Linux.

```bash
"$MBA_PYTHON" -B scripts/local-rag/diagnose_retrieval.py \
  --manifest "$RAG_CORPUS_MANIFEST" \
  --query "Theo giáo trình, vật chất được định nghĩa như thế nào?" \
  --query "Trình bày định nghĩa vật chất của V.I. Lênin." \
  --term "thực tại khách quan" \
  --term "cảm giác" \
  --term "V.I. Lênin" \
  --top-k 8 \
  --output "$PILOT_ROOT/private/retrieval-diagnostic-v1.json"
chmod 600 "$PILOT_ROOT/private/retrieval-diagnostic-v1.json"
```

Nếu đoạn hỗ trợ nằm hạng 4–5 thì thử `top5-v2`. Nếu chỉ nằm ở chunk liền kề hoặc ngoài top 8, không bật
profile mới chỉ để làm đẹp một câu hỏi; đánh giá adjacent context hoặc query expansion ở phase riêng.

Sau khi baseline cho thấy câu tự nhiên không tìm thấy đoạn hỗ trợ trong top 8, so sánh profile mở rộng mà
vẫn không gọi model:

```bash
"$MBA_PYTHON" -B scripts/local-rag/diagnose_retrieval.py \
  --manifest "$RAG_CORPUS_MANIFEST" \
  --profile expanded-v3 \
  --query "Theo giáo trình, vật chất được định nghĩa như thế nào?" \
  --query "Trình bày định nghĩa vật chất của V.I. Lênin." \
  --term "thực tại khách quan" \
  --term "cảm giác" \
  --term "V.I. Lênin" \
  --top-k 8 \
  --output "$PILOT_ROOT/private/retrieval-diagnostic-expanded-v3.json"
```

Ở terminal khác, giữ nguyên các biến rồi chạy:

```bash
npm run local:rag:smoke
```

Smoke xác minh login, mode private, citation quote/hash/trang PDF, persistence, abstention và chặn
môn ngoài quyền. Nên kiểm tra thêm ít nhất các câu:

- `Vật chất là gì?`
- `Mối quan hệ giữa vật chất và ý thức được trình bày như thế nào?`
- `Thực tiễn có vai trò gì đối với nhận thức?`
- `zzqxwwvvuu zzzqqqppp` — phải abstain, không tạo nguồn giả.

## Chuyển từ sample và rollback

Chỉ dừng đúng launcher/tmux của pilot sau khi ingest, preflight và build đã đạt. Không kill theo tên
process, không tác động Mongo/Docker/service khác. Trước khi thay DB private hiện có, copy nó sang
tên backup có timestamp. Không xóa PDF, corpus cũ hay DB mẫu.

Rollback an toàn:

1. Dừng đúng session pilot do tài khoản vận hành tạo bằng `npm run local:rag:stop`. Script xác minh PID,
   executable và thời điểm khởi chạy đã ghi trong `data/local-rag/runtime.json` trước khi gửi SIGTERM; nếu
   bất kỳ danh tính tiến trình nào không khớp, script từ chối dừng toàn bộ.
2. Bỏ `RAG_DATASET` và `RAG_CORPUS_MANIFEST` hoặc đặt `RAG_DATASET=sample`.
3. Khởi động lại `npm run local:rag`; launcher quay về `data/local-rag/pilot.sqlite`.
4. Chạy smoke sample. Corpus private vẫn được giữ nguyên để điều tra hoặc chạy lại.

## Giới hạn còn lại

- BM25 kém với câu đồng nghĩa và không thay thế dense retrieval/rerank.
- Chế độ extractive chỉ trả đoạn khớp; chế độ model có tổng hợp nhưng vẫn phụ thuộc chất lượng chunk BM25.
- `top5-v2` có thể tăng recall nhưng gửi nhiều nội dung private hơn tới provider và tăng input token.
- `page` trong citation là trang PDF; trang in chỉ được lưu trong chunk và có thể thiếu.
- Hai PDF scan không có text layer vẫn cần một phase OCR riêng; pipeline này chủ động từ chối corpus
  không sinh được text, không tự OCR hoặc cài thêm gói hệ thống.
- Chưa đủ căn cứ để public dịch vụ, đánh giá tải lớn hoặc gọi đây là nguồn đã phê duyệt.

## Chạy baseline retrieval

Bộ eval bootstrap được commit tại `eval/private-triet-hoc-retrieval-v1.json`. Chạy trên server và
giữ report đầy đủ trong thư mục private:

```bash
cd "$APP_ROOT"
"$MBA_PYTHON" -B scripts/local-rag/evaluate_retrieval.py \
  --manifest "$RAG_CORPUS_MANIFEST" \
  --eval-set eval/private-triet-hoc-retrieval-v1.json \
  --output "$PILOT_ROOT/private/retrieval-baseline-v1.json" \
  --summary-only
chmod 600 "$PILOT_ROOT/private/retrieval-baseline-v1.json"
```

`--summary-only` chỉ giới hạn stdout; file report vẫn có kết quả theo case nhưng không chứa query,
quote, chunk text hoặc section. Kết quả baseline đầu tiên và phân tích threshold được ghi tại
`docs/RAG_RETRIEVAL_BASELINE_V1.md`.
