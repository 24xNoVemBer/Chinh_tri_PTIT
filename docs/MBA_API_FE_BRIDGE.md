# Nối chatbot PTIT với MBA_API hiện có

Luồng: trình duyệt → backend PTIT `/api/student/chat` → MBA_API `POST /chat`.
Trình duyệt giữ đăng nhập và lựa chọn học phần/lớp như hiện tại. Backend PTIT
kiểm tra ghi danh, lấy `source` từ mapping cấu hình, rồi gọi MBA_API. Repo
MBA_API không cần sửa cho chế độ thử nghiệm này.

## Cấu hình

MBA_API cần chạy sẵn và có collection tài liệu cho `source` tương ứng. Xác minh
URL mà **backend PTIT** gọi được bằng `GET <base-url>/health`. Nếu gọi qua proxy
có prefix `/mba_mini`, đưa prefix đó vào base URL; nếu gọi trực tiếp Uvicorn,
thử URL không có prefix. Không đoán mã `source` từ tên môn: đối chiếu với
collection/source đã nạp trên MBA_API.
`GET <base-url>/files` có thể liệt kê các `source_id` hiện có; chỉ chọn source
chứa giáo trình đúng môn và đúng phạm vi lớp. Không cần gọi endpoint upload.

Trong môi trường chạy backend PTIT:

```dotenv
RAG_ENABLED=false
RAG_DEMO_DATA=false
MBA_CHAT_ENABLED=true
MBA_CHAT_BASE_URL=http://127.0.0.1:4558
MBA_CHAT_SOURCE_MAP={"sub1":"<source-thuc-te-trong-MBA>"}
MBA_CHAT_TIMEOUT_MS=60000
```

`MBA_CHAT_BASE_URL` chỉ chấp nhận HTTPS hoặc HTTP loopback. Không cấu hình
`MBA_CHAT_ENABLED=true` và `RAG_ENABLED=true` cùng lúc. Nếu MBA_API chạy trên
máy khác, dùng URL HTTPS hoặc tunnel loopback ở máy chạy backend PTIT.

Sau khi cấu hình, khởi động backend PTIT và kiểm tra:

1. `GET /api/ready`: `rag: "ready"` khi MBA_API health trả `healthy`.
2. Đăng nhập sinh viên, mở `/student/chat`: badge là “Đã kết nối MBA_API”.
3. Chọn môn/lớp có mapping và gửi một câu hỏi. Backend gửi tới MBA_API với
   `userId` có prefix `ptit:`, `mode: default`, `save: false` và session mới.
4. Các đoạn MBA trả trong `sources` được hiển thị là nguồn truy xuất chưa đối
   chiếu; không được ghi thành citation đã phê duyệt của PTIT.

## Giới hạn hiện tại

- MBA_API `/chat` không nhận allow-list material version của lớp; mapping chỉ
  dùng được khi collection MBA dành riêng và phù hợp toàn bộ lớp được nối.
- MBA trả `id`, `file_name`, `text`, `score`, chưa đủ material version, hash và
  trang để kiểm tra citation. Câu trả lời và nguồn được gắn nhãn chưa xác thực.
- `save: false` giữ mỗi câu hỏi độc lập. Backend PTIT không ghi câu trả lời của
  bridge vào hàng đợi duyệt hay lịch sử RAG chính thức. Muốn hỗ trợ hội thoại
  nhiều lượt và duyệt chính thức cần contract nội bộ có scope/provenance đầy đủ.
- MBA_API `/chat` là non-stream. UI chờ câu trả lời hoàn chỉnh; timeout có thể
  chỉnh bằng `MBA_CHAT_TIMEOUT_MS` (tối đa 120 giây).
