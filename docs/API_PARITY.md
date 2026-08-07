# API parity staging check

`npm run api:parity` đối chiếu deployment với HTTP contract trước khi chạy load test.

Chế độ mặc định không thay đổi dữ liệu học tập, câu hỏi hoặc RAG. Tuy nhiên, nếu cung cấp
credential thì thao tác đăng nhập vẫn tạo một session và một audit log `auth.login`. Chỉ hai
kiểm tra `/api/health` và `/api/ready` không có credential mới hoàn toàn không ghi database.

## Kiểm tra mặc định

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

Nếu chưa có tài khoản, có thể chỉ kiểm tra health/readiness:

```powershell
npm run api:parity -- --base-url http://127.0.0.1:3001
```

Hai nhóm route yêu cầu tài khoản sẽ có trạng thái `skipped`. Kết quả JSON gồm từng check,
HTTP timing và trạng thái `passed`; exit code là `1` khi có lỗi.

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
$env:PARITY_SUBJECT_ID = "sub1"
$env:PARITY_LESSON_ID = "les3"
npm run api:parity -- --write
```

Không bật `PARITY_ALLOW_WRITES` trên production.

## Thứ tự chạy

1. Chạy `db:validate:staging` với snapshot để đối chiếu exact row count.
2. Chạy parity mặc định.
3. Chỉ chạy write parity trên database disposable.
4. Sau khi parity đạt, chạy load profile phù hợp trong [LOAD_TEST.md](./LOAD_TEST.md).

Exact row-count validation phải chạy trước parity vì mỗi lần đăng nhập làm tăng `sessions` và
`audit_logs`.
