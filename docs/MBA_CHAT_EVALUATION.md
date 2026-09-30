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

## Kiểm thử giao diện và phân tách ngữ cảnh

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
