# Ngân hàng câu hỏi và luyện tập trắc nghiệm

## Phạm vi hiện tại

MVP hỗ trợ admin và giảng viên nhập thủ công hoặc nhập hàng loạt từ CSV các câu hỏi trắc nghiệm một đáp án đúng. Câu hỏi được gắn với học phần và chương, có bốn lựa chọn A–D và giải thích đáp án. Câu hỏi phải ở trạng thái `published` trước khi sinh viên nhìn thấy. Câu do admin nhập có phạm vi dùng chung toàn môn; câu do giảng viên nhập chỉ áp dụng cho các lớp được phân công.

Excel, Word, PDF và OCR chưa nằm trong MVP. Trường `source_type` phân biệt câu nhập thủ công (`manual`) và nhập từ CSV (`csv`).

## Luồng nghiệp vụ

1. Giảng viên mở **Ngân hàng câu hỏi** và tạo thủ công hoặc chọn **Nhập từ CSV**.
2. Backend kiểm tra quyền giảng viên với học phần, quan hệ học phần–chương–bài học và cấu trúc bốn lựa chọn.
3. Câu hỏi được lưu ở trạng thái `draft` hoặc xuất bản ngay sau khi lưu.
4. Sinh viên chọn **Luyện tập** hoặc **Thi thử**, phạm vi học phần/chương, số lượng câu và tùy chọn trộn câu hỏi.
5. Backend tạo một phiên, chọn ngẫu nhiên các câu đã xuất bản và cố định thứ tự trong phiên.
6. Ở chế độ Luyện tập, backend trả đáp án đúng và giải thích ngay sau mỗi lựa chọn.
7. Ở chế độ Thi thử, sinh viên có thể xem lại và đổi lựa chọn; đáp án, giải thích và điểm được giữ kín đến khi nộp bài.
8. Khi trả lời hết, sinh viên hoàn thành phiên và xem tổng kết.

## Hai chế độ làm bài

- `practice`: phản hồi tức thì sau từng câu, phù hợp để học và củng cố kiến thức.
- `mock_exam`: phản hồi trì hoãn đến khi nộp bài, phù hợp để tự đánh giá.
- `randomize: true`: lấy tập câu ngẫu nhiên trong phạm vi đã chọn; thứ tự được lưu cố định trong phiên.
- `retry_wrong`: luôn tạo một phiên luyện tập mới từ các câu trả lời sai của phiên trước.

## Định dạng CSV

Giảng viên tải file mẫu ngay tại `/lecturer/practice-questions/import`, giữ nguyên hàng tiêu đề và điền mỗi câu hỏi trên một dòng:

Admin sử dụng cùng định dạng tại `/admin/question-bank/import`; toàn bộ câu hỏi được lưu nháp trong ngân hàng dùng chung của môn.

`noi_dung,dap_an_a,dap_an_b,dap_an_c,dap_an_d,dap_an_dung,giai_thich`

- `dap_an_dung`: `A`, `B`, `C` hoặc `D`.
- Tối đa 200 câu và 1 MB mỗi lần nhập.
- Hệ thống xem trước và báo lỗi theo từng dòng; chỉ nhập khi toàn bộ file hợp lệ.
- Toàn bộ lô được ghi trong một transaction và luôn bắt đầu ở trạng thái `draft`.

## API chính

Admin:

- `GET /api/admin/practice-questions`
- `POST /api/admin/practice-questions`
- `POST /api/admin/practice-questions/import`
- `PATCH /api/admin/practice-questions/:id`
- `DELETE /api/admin/practice-questions/:id`

Giảng viên:

- `GET /api/lecturer/practice-questions`
- `POST /api/lecturer/practice-questions`
- `POST /api/lecturer/practice-questions/import`
- `GET /api/lecturer/practice-questions/:id`
- `PATCH /api/lecturer/practice-questions/:id`
- `POST /api/lecturer/practice-questions/:id/publish`
- `POST /api/lecturer/practice-questions/:id/archive`

Sinh viên:

- `GET /api/student/practice/config/:subjectId`
- `POST /api/student/practice-sessions`
- `GET /api/student/practice-sessions/:id`
- `POST /api/student/practice-sessions/:id/answers`
- `POST /api/student/practice-sessions/:id/complete`
- `GET /api/student/practice-sessions/history`

API lấy câu hỏi cho sinh viên không trả đáp án đúng trước khi sinh viên trả lời. Trong phiên Luyện tập, endpoint `answers` từ chối lựa chọn thứ hai; trong phiên Thi thử, sinh viên được đổi lựa chọn nhưng kết quả vẫn được giữ kín đến khi nộp.

## Bảng dữ liệu

- `practice_questions`: nội dung, phạm vi học phần/chương, giải thích và trạng thái xuất bản.
- `practice_question_options`: bốn lựa chọn và đáp án đúng.
- `practice_sessions`: phiên luyện tập và thống kê tiến độ.
- `practice_session_questions`: thứ tự câu, lựa chọn đã chọn và kết quả từng câu.

Các bảng này tách khỏi `questions`, vốn dành cho câu hỏi sinh viên gửi giảng viên/RAG.

## Mở rộng import sau này

Import Excel/Word nên đi qua cùng pipeline đang dùng cho CSV: parse thành payload chuẩn → preview và sửa lỗi → validate ở backend → lưu nháp → xuất bản. Không cho phép client ghi thẳng dữ liệu đã parse vào ngân hàng câu hỏi.
