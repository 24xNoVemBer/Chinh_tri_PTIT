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
`GET <base-url>/files` có thể liệt kê `source_id` nhưng đã timeout trên server
có nhiều collection. Kiểm tra collection/source cụ thể bằng API hoặc metadata
của MBA_API. Nếu source chưa có, nạp tài liệu qua luồng upload hiện có của MBA_API
sau khi xác nhận contract; không cần sửa code repo MBA_API.

### Năm học phần chính trị

Mã học phần dưới đây theo [phụ lục chương trình đào tạo PTIT](https://ptit.edu.vn/wp-content/uploads/2024/10/1.-Bieu-mau-17-Phu-luc-DH19.KTDL_.pdf).
`sub1`–`sub5` là ID nội bộ trong app. MBA_API dùng `source` để chọn collection
`COLLECTION_PREFIX + source`; mã PTIT là giá trị source dự kiến cho năm môn.
Chọn một source riêng cho từng môn vì cả LangGraph lẫn luồng legacy đều truy xuất
toàn bộ collection của `source`; `metadata.subject_name` không lọc theo môn.

| App                                  | Mã PTIT / source dự kiến | Tài liệu chính trong `Backup_GT_CHINH_TRI`                                                 |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| `sub1` Triết học Mác - Lênin         | `BAS1150`                | `Triết học/20260729_075440_BAI GIANG TRIET HOC MAC-LENIN.pdf`                              |
| `sub2` Kinh tế chính trị Mác - Lênin | `BAS1151`                | `Kinh tế chính trị/20260727_045942_BAI GIANG KTCT 2021.pdf`                                |
| `sub3` Chủ nghĩa xã hội khoa học     | `BAS1152`                | `Chủ nghĩa xã  hội/20260730_013242_BAI GIANG CNXHKH - HOAN CHINH NHAT - IN 10-12-2021.pdf` |
| `sub4` Tư tưởng Hồ Chí Minh          | `BAS1122`                | `Tư tưởng hồ chí minh/20260718_105355_Giao trinh TTHCM khong chuyen.pdf`                   |
| `sub5` Lịch sử Đảng CSVN             | `BAS1153`                | `Lịch sử đảng/20260724_032101_Giáo trình Lịch sử Đảng.2021.pdf`                            |

Chạy `npm run mba:corpus:audit -- --root "D:\Backup_GT_CHINH_TRI"` trên máy
local, hoặc truyền đường dẫn tới bản backup đã chép lên server. Script chỉ đọc,
kiểm tra chữ ký PDF và SHA-256 cho mọi PDF trong năm thư mục môn. `uploadDocuments`
liệt kê mọi PDF hợp lệ để nạp vào source tương ứng; `excludedDocuments` liệt kê
file lỗi. Kiểm tra chữ ký chưa thay thế bước thử parser/OCR khi nạp. Giữ các PDF
trong kho private; script không sao chép chúng vào repo.
Hai file mang tên giáo trình Triết và Chủ nghĩa xã hội
khoa học trong bản backup hiện tại thực chất là JSON lỗi 118/139 byte báo file
không tồn tại trong source `BAS1150`/`BAS1152`; không nạp chúng. Bài giảng
tương ứng là PDF hợp lệ. Các file hợp lệ khác cùng thư mục được đưa vào source
của môn đó dưới vai trò tài liệu bổ sung.

### Upload MBA_API (đã xác nhận từ OpenAPI và handler trên server)

`POST /upload` nhận multipart với `file_id` (form field) và `files` (một hoặc
nhiều tệp). `file_id` là source ID; handler lưu vào `mba_source_dir(file_id)`,
ghi metadata theo kiểu append rồi chạy `process_vectors_sync` ở thread nền.
Với `COLLECTION_PREFIX=mba_mini`, source `BAS1150` được index vào
`mba_miniBAS1150`.

`create_or_update_node` gọi `insert_nodes` nếu collection đã tồn tại, không xóa
hay thay collection. Filename lưu có timestamp, metadata cũng append; endpoint
không có idempotency key. Vì vậy không gửi lại request upload khi chưa xác minh
kết quả lần trước, và trước lần nạp đầu phải kiểm tra riêng cả thư mục dữ liệu
lẫn collection của năm source đích.

API trả `status: uploaded` ngay sau khi lưu tệp; vector hóa/index chạy nền và
handler này không đợi hoàn tất. Không xem HTTP 200 là xác nhận RAG đã sẵn sàng.
Sau mỗi source cần đợi/log hoặc kiểm tra index rồi chạy truy vấn thử có citation
đúng môn trước khi bật mapping cho sinh viên.

Trên máy có bản backup, mở SSH tunnel loopback đến MBA_API rồi chạy dry-run:

```powershell
npm run mba:corpus:upload -- --root "D:\Backup_GT_CHINH_TRI" --source BAS1150
```

Mặc định lệnh chỉ audit/in danh sách, không gọi mạng; mỗi lần chỉ chọn một source.
Chỉ thêm cả `--confirm-source-empty --confirm-upload` sau khi kiểm tra source vẫn
trống và đã quyết định ghi dữ liệu. Không tự retry nếu request timeout/lỗi:
endpoint có thể đã lưu file trước khi mất phản hồi. Chờ kiểm tra indexing xong
trước khi chạy lệnh cho môn kế.

Đã kiểm tra cả năm collection và thử `/chat` với câu hỏi từng môn. Chỉ bật bốn
source `BAS1150`, `BAS1151`, `BAS1152`, `BAS1153` cho sinh viên trong giai đoạn
này. Source `BAS1122` có tệp bổ sung `Giao trinh TTHCM chuyen.pdf` ghi rõ
"Đang trong quá trình xin ý kiến góp ý để hoàn thiện. Không phổ biến"; chờ
giảng viên cho phép sử dụng hoặc chuẩn bị source chỉ gồm tài liệu được duyệt.
Không thêm `sub4` vào mapping cho tới khi xử lý xong.

Trong môi trường chạy backend PTIT:

```dotenv
RAG_ENABLED=false
RAG_DEMO_DATA=false
MBA_CHAT_ENABLED=true
MBA_CHAT_BASE_URL=http://127.0.0.1:4558
MBA_CHAT_SOURCE_MAP={"sub1":"BAS1150","sub2":"BAS1151","sub3":"BAS1152","sub5":"BAS1153"}
MBA_CHAT_TIMEOUT_MS=60000
```

`MBA_CHAT_BASE_URL` chỉ chấp nhận HTTPS hoặc HTTP loopback. Không cấu hình
`MBA_CHAT_ENABLED=true` và `RAG_ENABLED=true` cùng lúc. Nếu MBA_API chạy trên
máy khác, dùng URL HTTPS hoặc tunnel loopback ở máy chạy backend PTIT.

Sau khi cấu hình, khởi động backend PTIT và kiểm tra:

1. `GET /api/ready`: `rag: "ready"` khi MBA_API health trả `healthy`.
2. Đăng nhập sinh viên, mở `/student/chat`: badge là “Đã kết nối MBA_API”.
   Status API trả `enabledSubjectIds` để FE chỉ hiển thị các học phần đã map;
   gợi ý câu hỏi và bảng nguồn đổi theo học phần đang chọn.
3. Chọn môn/lớp có mapping và ghi danh hợp lệ rồi gửi một câu hỏi. Nếu học kỳ
   chưa có lớp/ghi danh cho môn đó, hoàn thiện dữ liệu lớp trước khi thử trên FE.
   Backend gửi tới MBA_API với
   `userId` có prefix `ptit:`, `mode: default`, `save: false` và session mới.
   `sub4` phải trả `SOURCE_NOT_MAPPED` (409), không gọi MBA_API.
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
