# Bộ kiểm thử chấp nhận chatbot MBA_API

## Mục tiêu và phạm vi

Bộ này dùng để đánh giá thủ công chatbot nối qua MBA_API trước khi mở rộng sử dụng. Nó không thay thế duyệt chuyên môn của giảng viên và không biến các đoạn trích MBA_API thành trích dẫn chính thức của PTIT.

Phạm vi hiện tại gồm bốn source đang được bật trong bridge: `BAS1150`, `BAS1151`, `BAS1152`, `BAS1153`. Không đưa `BAS1122` vào kiểm thử chấp nhận cho đến khi tài liệu bổ sung có ghi chú “không phổ biến” được giảng viên xác nhận hoặc loại khỏi source.

## Nguyên tắc đánh giá

Đánh giá từng câu trả lời theo ba phần riêng biệt:

1. **Nội dung:** có đủ các ý bắt buộc, không sai lệch khái niệm, không thêm khẳng định quan trọng không có căn cứ.
2. **Nguồn:** đoạn trích thực sự hỗ trợ các ý trong câu trả lời và thuộc đúng học phần; không chấp nhận chỉ dựa vào điểm retrieval cao.
3. **Truy nguyên:** ghi lại tên tệp và trang nếu API cung cấp. Bridge hiện chưa nhận đủ phiên bản tài liệu, hash và số trang ổn định từ MBA_API, vì vậy nguồn chỉ được xem là _chưa xác minh_ cho đến khi người duyệt đối chiếu tài liệu gốc.

Kết quả cho mỗi câu:

- **PASS** — nội dung đúng theo tiêu chí, nguồn đúng môn và trực tiếp hỗ trợ câu trả lời, truy nguyên đủ để người duyệt xác nhận.
- **HOLD** — nội dung có vẻ phù hợp nhưng thiếu trang/phiên bản, nguồn chưa được duyệt, hoặc chưa thể đối chiếu tài liệu gốc.
- **FAIL** — sai kiến thức, thiếu ý cốt lõi, lấy nguồn nhầm môn, hoặc có khẳng định không được đoạn trích hỗ trợ.

Không dùng điểm retrieval hoặc câu trả lời trôi chảy làm tiêu chí thay thế cho việc đối chiếu nguồn.

## Câu hỏi chuẩn

| Source                                     | Câu hỏi                                                                                                 | Các ý bắt buộc trong đáp án                                                                                                                                                | Kiểm tra nguồn                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAS1150` — Triết học Mác–Lênin            | “Trình bày định nghĩa vật chất của V.I. Lênin theo giáo trình.”                                         | Vật chất là phạm trù triết học; chỉ thực tại khách quan; được đem lại trong cảm giác và được cảm giác phản ánh; tồn tại không lệ thuộc vào cảm giác.                       | Đoạn trích phải nêu trực tiếp định nghĩa trong tài liệu Triết học, không chỉ nói khái quát vật chất tồn tại khách quan.                                 |
| `BAS1151` — Kinh tế chính trị Mác–Lênin    | “Theo giáo trình, hàng hóa có những thuộc tính cơ bản nào?”                                             | Nêu đủ giá trị sử dụng và giá trị; phân biệt công dụng/thỏa mãn nhu cầu với lao động xã hội kết tinh trong hàng hóa.                                                       | Đoạn trích cần hỗ trợ cả hai thuộc tính. Nếu các đoạn được trả về chỉ giải thích một thuộc tính thì đánh dấu HOLD hoặc FAIL theo phần đáp án còn thiếu. |
| `BAS1152` — Chủ nghĩa xã hội khoa học      | “Theo giáo trình, sứ mệnh lịch sử của giai cấp công nhân là gì?”                                        | Nêu nội dung tổng quát, vai trò tổ chức/lãnh đạo và mục tiêu giải phóng, cải biến xã hội theo tài liệu môn học; không thu hẹp thành một khẩu hiệu không được nguồn hỗ trợ. | Ưu tiên đoạn trích trực tiếp ở mục về sứ mệnh lịch sử của giai cấp công nhân; ghi tên tệp và trang để đối chiếu.                                        |
| `BAS1153` — Lịch sử Đảng Cộng sản Việt Nam | “Đại hội XIII xác định mục tiêu phát triển đất nước đến năm 2030 và tầm nhìn đến năm 2045 như thế nào?” | Đến 2030: nước đang phát triển, có công nghiệp hiện đại, thu nhập trung bình cao. Đến 2045: nước phát triển, thu nhập cao. Giữ đúng mốc và mô tả mục tiêu.                 | Đoạn trích phải khớp cả hai mốc với văn kiện/tài liệu được duyệt; không lấy nhầm mục tiêu của Đại hội XI hoặc tài liệu cũ.                              |

Các câu trên là bộ khởi đầu dựa trên những câu đã dùng để smoke-test. Chúng chưa được đánh dấu PASS chuyên môn; cần chạy lại trên demo và ghi nhận phản hồi/source thực tế.

### Lấy output đầy đủ cho từng source

Runner chỉ xử lý một source mỗi lần và mặc định là dry-run. Chạy ở máy có thể truy cập MBA_API trực tiếp hoặc qua SSH tunnel:

```bash
npm run mba:chat:eval -- --source BAS1151
npm run mba:chat:eval -- --source BAS1151 --run --confirm-chat-request
npm run mba:chat:eval -- --source BAS1151 --question "Theo giáo trình, giá trị sử dụng của hàng hóa là gì?"
```

Đổi `BAS1151` thành một source khác trong bộ kiểm thử. `--question` dùng để chẩn đoán truy vấn tùy chỉnh; nó vẫn chỉ dry-run trừ khi đi kèm cả `--run --confirm-chat-request`. Request thật có thể tiêu thụ quota model; dù payload đặt `save: false`, không coi đó là bảo đảm MBA_API không persist cho đến khi xác minh handler. Runner chỉ nhận URL loopback (mặc định `http://127.0.0.1:4558`), in toàn bộ nội dung các đoạn trích và không tự chấm PASS/FAIL. Chỉ chạy request thật sau khi xem dry-run và xác nhận.

## Baseline từ smoke-test đã nhận

Các baseline dưới đây kết hợp output live đầy đủ của `BAS1151`/`BAS1153` với output smoke-test cũ đã rút gọn của `BAS1150`/`BAS1152`. Đây là đánh giá kỹ thuật, không phải xác nhận của giảng viên.

| Source    | Quan sát từ output                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Baseline                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAS1150` | Câu trả lời nêu định nghĩa Lênin; kết quả có đoạn trích từ đúng PDF Triết học, trong đó output hiển thị trang 31 và phần mở đầu định nghĩa.                                                                                                                                                                                                                                                                                                                                     | Nội dung/nguồn có vẻ phù hợp. **HOLD** để đối chiếu toàn văn đoạn trích và xác nhận trang/phiên bản.                                                                                                                                                                                                                                                                                |
| `BAS1151` | Với câu hỏi rộng, 8 đoạn trả về không có định nghĩa trực tiếp giá trị sử dụng. Request live chẩn đoán riêng cho “giá trị sử dụng của hàng hóa là gì?” trả lời đúng; trong 8 đoạn, đoạn #7 từ đúng PDF nêu trực tiếp định nghĩa “công dụng của vật, có thể thỏa mãn một nhu cầu...” (score `0.60252917`). Đoạn trực tiếp nằm sau nhiều đoạn không liên quan hoặc chỉ hỗ trợ một phần; output dán lên cũng bị lỗi mã hóa tiếng Việt nên cần giữ nguyên kết quả gốc khi đối chiếu. | **FAIL về thứ hạng retrieval**, không phải thiếu dữ liệu trong index: chunk đúng đứng #7/8. Bridge trước đây chỉ giữ 5 nguồn đầu nên làm rơi chunk này; local change hiện giữ tối đa 8 nguồn và có regression test, nhưng chưa triển khai lên demo. Câu hỏi rộng vẫn chưa có bằng chứng trực tiếp cho cả hai thuộc tính ở đầu kết quả. Cần điều tra ranking trước khi coi case đạt. |
| `BAS1152` | Câu trả lời về sứ mệnh lịch sử có đoạn trích trực tiếp từ mục 2.1.2 của đúng PDF; output hiển thị Page 24.                                                                                                                                                                                                                                                                                                                                                                      | Nội dung/nguồn có vẻ phù hợp. **HOLD** để đối chiếu tài liệu gốc và xác nhận trang/phiên bản.                                                                                                                                                                                                                                                                                       |
| `BAS1153` | Đoạn #1 từ `20260724_031656_BG LSD. 12.12.2021. bản chuẩn.pdf` ghi trực tiếp cả mục tiêu 2030 và 2045; đáp án khớp. Các đoạn #6–#8 đến từ tài liệu Đại hội XI về mục tiêu cũ.                                                                                                                                                                                                                                                                                                   | Nội dung có hỗ trợ trực tiếp trong bài giảng, nhưng **HOLD** cho provenance: đây là tệp bổ sung, không có page locator riêng cho đoạn mục tiêu; retrieval còn trả tài liệu Đại hội XI ở thứ hạng thấp. Xác nhận tài liệu được duyệt/trang trước khi đánh dấu PASS.                                                                                                                  |

### Chẩn đoán tiếp theo cho `BAS1151`

Không sửa prompt hay giao diện để che lỗi bằng chứng. Đính chính số đếm từ log gốc: truy vấn hẹp trả 8 đoạn, chunk trực tiếp ở vị trí #7/8 (score `0.60252917`), còn các chunk đứng trước phần lớn không trực tiếp trả lời định nghĩa. Bridge trước đây cắt còn 5 và làm rơi chunk; thay đổi cục bộ hiện giữ tối đa 8 để nguồn này tới được panel mở rộng, nhưng cần test và triển khai trước khi có hiệu lực trên demo. Việc giữ thêm nguồn không sửa lỗi xếp hạng.

Đọc code và cấu hình runtime MBA_API được cung cấp: dense top-k là 12, LLM rerank đang bật với input 12 và final top-N 8. `hybrid_retrieve` hợp nhất dense/BM25 bằng RRF trước khi rerank; reranker xem 450 ký tự đầu mỗi candidate. Điểm `score` gắn lên output vẫn là điểm dense, không phải điểm rerank. Vì chưa có thứ hạng candidate trước rerank hoặc log thứ tự do reranker trả về, chưa thể xác định chính xác tầng nào đã đẩy chunk xuống #7. Bridge hiện được chỉnh để chuyển đủ tối đa 8 đoạn; regression test xác nhận đoạn thứ bảy được giữ lại, nhưng thứ hạng retrieval vẫn là lỗi ở MBA_API. Bước tiếp theo nên là thêm logging tạm thời cho ID/thứ hạng ngay trước/sau rerank, rồi dùng một request được xác nhận riêng để đối chiếu; chưa thay cấu hình hay gửi request thêm. Không kiểm tra parser/chunk boundary trừ khi thấy chunk đúng bị cắt/mất trong PDF/index.

Từ ảnh giao diện đã nhận: đổi học phần từ Chủ nghĩa xã hội khoa học sang Kinh tế chính trị làm ẩn hội thoại trước đó. Chưa có ảnh xác nhận đổi giữa hai lớp thuộc cùng một học phần.

## Kiểm thử giao diện và phân tách ngữ cảnh

Đã có regression test component trong `src/pages/student/ChatPage.test.jsx`: trong cùng học phần, đổi lớp `c1` sang `c1-alt` ẩn tin nhắn/nguồn của lớp cũ; quay lại `c1` khôi phục chúng. Test cũng kiểm tra đổi học phần và nhãn nguồn chưa xác thực. Lượt chạy kiểm chứng hiện tại: `ChatPage.test.jsx` và `server/mba/chatIntegration.test.js`, 2 file / 8 test đều đạt. Các checkbox dưới đây vẫn dành cho smoke-test trực tiếp trên UI/server demo.

- [ ] Câu hỏi và câu trả lời ở học phần A không xuất hiện khi chuyển sang học phần B.
- [ ] Nguồn bên phải chỉ hiển thị nguồn của học phần/lớp đang chọn.
- [ ] Quay lại A khôi phục đúng hội thoại và nguồn của A.
- [ ] **Cùng một học phần, hai lớp khác nhau:** gửi câu hỏi ở lớp A, chuyển sang lớp B, xác nhận tin nhắn và nguồn của A bị ẩn; quay lại A và xác nhận chúng trở lại. Đây là kiểm tra riêng, không được xem là đạt chỉ từ ảnh đổi đồng thời cả học phần và lớp.
- [ ] Gửi một câu hỏi chuẩn cho mỗi source đã bật; xác nhận học phần được chọn, tên tệp nguồn và đoạn trích đều cùng môn.
- [ ] Kiểm tra badge nguồn vẫn ghi rõ “chưa được đối chiếu học liệu lớp”/“chưa xác thực trích dẫn” cho đến khi có quy trình duyệt nguồn.

## Nhật ký một lượt đánh giá

Sao chép mẫu này cho từng câu hỏi:

```text
Ngày/commit demo:
Người đánh giá:
Học phần / lớp:
Source ID:
Câu hỏi:
Các ý bắt buộc: đủ / thiếu (ghi rõ)
Tên tệp trong nguồn trả về:
Trang (nếu có):
Đoạn trích hỗ trợ trực tiếp: có / một phần / không
Có khẳng định quan trọng không được nguồn hỗ trợ: có / không
Kết quả: PASS / HOLD / FAIL
Ghi chú hoặc lỗi cần sửa:
```

## Điều kiện trước khi mở rộng

1. Hoàn tất kiểm thử đổi lớp trong cùng một học phần.
2. Chạy lại bốn câu chuẩn, lưu nguồn trả về và cho người có chuyên môn đối chiếu tài liệu gốc.
3. Ghi lại lỗi retrieval/đáp án theo source; chỉ thay đổi prompt, mapping hoặc corpus sau khi xác định được nguyên nhân.
4. Chưa tuyên bố citation đã xác minh và chưa bật source có tài liệu chưa được duyệt chỉ dựa trên smoke-test thành công.
