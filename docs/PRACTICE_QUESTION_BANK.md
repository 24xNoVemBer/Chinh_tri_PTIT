# Ngân hàng câu hỏi và luyện tập trắc nghiệm

## Phạm vi hiện tại

MVP hỗ trợ giảng viên nhập thủ công câu hỏi trắc nghiệm một đáp án đúng. Câu hỏi được gắn với học phần và chương, có bốn lựa chọn A–D, giải thích và độ khó. Câu hỏi phải ở trạng thái `published` trước khi sinh viên nhìn thấy.

Excel, Word, PDF và OCR chưa nằm trong MVP. Trường `source_type` đã được chuẩn bị với giá trị `manual` để mở rộng import sau này.

## Luồng nghiệp vụ

1. Giảng viên mở **Ngân hàng câu hỏi** và tạo câu hỏi.
2. Backend kiểm tra quyền giảng viên với học phần, quan hệ học phần–chương–bài học và cấu trúc bốn lựa chọn.
3. Câu hỏi được lưu ở trạng thái `draft` hoặc xuất bản ngay sau khi lưu.
4. Sinh viên chọn học phần/chương và số lượng câu.
5. Backend tạo một phiên, chọn ngẫu nhiên các câu đã xuất bản và cố định thứ tự trong phiên.
6. Khi sinh viên chọn đáp án, backend chấm trong transaction, lưu lựa chọn một lần và trả đáp án đúng cùng giải thích.
7. Khi trả lời hết, sinh viên hoàn thành phiên và xem tổng kết.

## API chính

Giảng viên:

- `GET /api/lecturer/practice-questions`
- `POST /api/lecturer/practice-questions`
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

Import Excel/Word nên đi qua cùng một pipeline: parse thành payload chuẩn → preview và sửa lỗi → validate ở backend → lưu nháp → xuất bản. Không cho phép client ghi thẳng dữ liệu đã parse vào ngân hàng câu hỏi.
