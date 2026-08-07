# API parity staging check

`npm run api:parity` đối chiếu deployment với HTTP contract trước khi chạy load test.

Chế độ authenticated mặc định đăng nhập cả sinh viên và giảng viên. Thao tác đăng nhập tạo session
và audit log `auth.login`; chỉ chế độ `--health-only` mới hoàn toàn không ghi database.

## Kiểm tra authenticated mặc định

Đặt credential bằng biến môi trường ở máy chạy kiểm thử; không commit credential vào repo và
không truyền mật khẩu trên command line dùng chung:

```powershell
$env:API_BASE_URL = "https://staging.example.ptit.edu.vn"
$env:PARITY_STUDENT_EMAIL = "student@ptit.edu.vn"
$env:PARITY_STUDENT_PASSWORD = "..."
$env:PARITY_LECTURER_EMAIL = "lecturer@ptit.edu.vn"
$env:PARITY_LECTURER_PASSWORD = "..."
npm run api:parity
```

Nếu chưa có tài khoản, phải chọn rõ chế độ chỉ kiểm tra health/readiness:

```powershell
npm run api:parity -- --health-only --base-url http://127.0.0.1:3001
```

Chế độ authenticated fail-closed nếu thiếu bất kỳ credential sinh viên/giảng viên nào; không còn
trả kết quả passed với các route chính bị skip. Kết quả JSON gồm mode, từng check, HTTP timing và
trạng thái `passed`; exit code là `1` khi có lỗi. Option sai hoặc positional argument bị từ chối.
Remote target bắt buộc là một HTTPS origin sạch, không credential/path/query/hash.

## Tiêu chí parity

- Health và readiness trả HTTP `200`.
- Tài khoản sinh viên đọc được session, dashboard, học phần, lịch sử hỏi đáp và lịch sử tra cứu.
- Tài khoản giảng viên đọc được session, lớp, câu hỏi, hàng đợi review RAG và audit log.
- Không có `5xx`, redirect đăng nhập bất ngờ hoặc payload không phải JSON.
- ID người dùng và role trả về đúng tài khoản đã đăng nhập.

## Write parity trên database dùng một lần

Chỉ chạy trên database staging tạm thời, đã backup và có thể khôi phục. Chế độ này:

1. đặt tiến độ của bài học kiểm thử thành `64`;
2. tạo một câu hỏi của sinh viên;
3. đọc và trả lời bằng tài khoản giảng viên;
4. xác nhận sinh viên thấy trạng thái `answered`;
5. xác nhận audit có `question.created` và `answer.created`.

Script không tự cleanup. Cần cả hai credential cùng `subjectId` và `lessonId` hợp lệ:

```powershell
$env:PARITY_ALLOW_WRITES = "true"
$env:PARITY_CONFIRM_DISPOSABLE = "true"
$env:PARITY_CONFIRM_HOST = "staging.example.ptit.edu.vn"
$env:PARITY_SUBJECT_ID = "sub1"
$env:PARITY_LESSON_ID = "les3"
npm run api:parity -- --write
```

Write parity chỉ chạy khi ba guard khớp đồng thời: `PARITY_ALLOW_WRITES=true`,
`PARITY_CONFIRM_DISPOSABLE=true` và `PARITY_CONFIRM_HOST` đúng target. Không bật các guard này
trên production.

## Thứ tự chạy

1. Chạy `db:validate:staging` với snapshot để đối chiếu exact row count và content fingerprint.
2. Kích hoạt đúng hai credential staging rồi chạy parity authenticated mặc định.
3. Chỉ chạy write parity trên database disposable.
4. Sau khi parity đạt, chạy load profile phù hợp trong [LOAD_TEST.md](./LOAD_TEST.md).

Exact validation phải chạy trước khi kích hoạt credential vì đổi password hash và mỗi lần đăng
nhập đều làm tăng `sessions`/`audit_logs`.
