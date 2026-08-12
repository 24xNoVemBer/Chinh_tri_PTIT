# Ngân hàng câu hỏi và luyện tập trắc nghiệm

## Phạm vi hiện tại

MVP hỗ trợ giảng viên nhập thủ công hoặc nhập hàng loạt từ CSV các câu hỏi trắc nghiệm một đáp án đúng. Câu hỏi được gắn với học phần và chương, có bốn lựa chọn A–D, giải thích và độ khó. Câu hỏi phải ở trạng thái `published` trước khi sinh viên nhìn thấy.

Excel, Word, PDF và OCR chưa nằm trong MVP. Trường `source_type` phân biệt câu nhập thủ công (`manual`) và nhập từ CSV (`csv`).

## Luồng nghiệp vụ

1. Giảng viên mở **Ngân hàng câu hỏi** và tạo thủ công hoặc chọn **Nhập từ CSV**.
2. Backend kiểm tra quyền giảng viên với học phần, quan hệ học phần–chương–bài học và cấu trúc bốn lựa chọn.
3. Câu hỏi được lưu ở trạng thái `draft` hoặc xuất bản ngay sau khi lưu.
4. Sinh viên chọn học phần/chương và số lượng câu.
5. Backend tạo một phiên, chọn ngẫu nhiên các câu đã xuất bản và cố định thứ tự trong phiên.
6. Khi sinh viên chọn đáp án, backend chấm trong transaction, lưu lựa chọn một lần và trả đáp án đúng cùng giải thích.
7. Khi trả lời hết, sinh viên hoàn thành phiên và xem tổng kết.

## Định dạng CSV

Giảng viên tải file mẫu ngay tại `/lecturer/practice-questions/import`, giữ nguyên hàng tiêu đề và điền mỗi câu hỏi trên một dòng:

`noi_dung,dap_an_a,dap_an_b,dap_an_c,dap_an_d,dap_an_dung,giai_thich,do_kho`

- `dap_an_dung`: `A`, `B`, `C` hoặc `D`.
- `do_kho`: `easy`, `medium` hoặc `hard`.
- Tối đa 200 câu và 1 MB mỗi lần nhập.
- Hệ thống xem trước và báo lỗi theo từng dòng; chỉ nhập khi toàn bộ file hợp lệ.
- Toàn bộ lô được ghi trong một transaction và luôn bắt đầu ở trạng thái `draft`.

## API chính

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

API lấy câu hỏi cho sinh viên không trả đáp án đúng trước khi sinh viên trả lời. Endpoint `answers` từ chối lựa chọn thứ hai cho cùng một câu trong cùng phiên.

## Bảng dữ liệu

- `practice_questions`: nội dung, phạm vi học phần/chương, giải thích, độ khó và trạng thái xuất bản.
- `practice_question_options`: bốn lựa chọn và đáp án đúng.
- `practice_sessions`: phiên luyện tập và thống kê tiến độ.
- `practice_session_questions`: thứ tự câu, lựa chọn đã chọn và kết quả từng câu.

Các bảng này tách khỏi `questions`, vốn dành cho câu hỏi sinh viên gửi giảng viên/RAG.

## Mở rộng import sau này

Import Excel/Word nên đi qua cùng pipeline đang dùng cho CSV: parse thành payload chuẩn → preview và sửa lỗi → validate ở backend → lưu nháp → xuất bản. Không cho phép client ghi thẳng dữ liệu đã parse vào ngân hàng câu hỏi.
