# API parity staging check

`api:parity` là smoke test read-only để đối chiếu deployment với HTTP contract
trước khi chạy load test. Script kiểm tra `/api/health`, `/api/ready`, sau đó
đăng nhập bằng tài khoản staging và gọi các route đọc chính của sinh viên và
giảng viên. Script không tạo câu hỏi, không cập nhật tiến độ và không gọi model
RAG.

## Chạy

Đặt biến môi trường ở máy chạy kiểm thử; không commit credential vào repo:

```powershell
$env:API_BASE_URL = "https://staging.example.ptit.edu.vn"
$env:PARITY_STUDENT_EMAIL = "student@ptit.edu.vn"
$env:PARITY_STUDENT_PASSWORD = "..."
$env:PARITY_LECTURER_EMAIL = "lecturer@ptit.edu.vn"
$env:PARITY_LECTURER_PASSWORD = "..."
npm run api:parity
```

Có thể chỉ kiểm tra readiness nếu chưa được cấp tài khoản; hai nhóm route còn
lại sẽ được đánh dấu `skipped`:

```powershell
npm run api:parity -- --base-url http://127.0.0.1:3001
```

Kết quả JSON gồm từng check, HTTP timing và trạng thái `passed`. Exit code là
`1` khi health/readiness hoặc bất kỳ route nào có tài khoản bị lỗi, phù hợp để
dùng trong CI/staging checklist.

## Tiêu chí parity

- Health và readiness trả HTTP `200`.
- Tài khoản sinh viên đọc được session, dashboard, học phần, lịch sử hỏi đáp
  và lịch sử tra cứu.
- Tài khoản giảng viên đọc được session, lớp, câu hỏi, hàng đợi review RAG và
  audit log.
- Không có `5xx`, redirect đăng nhập bất ngờ hoặc payload không phải JSON.

Sau parity mới chạy `npm run load:test` trên cùng deployment và ghi lại p50,
p95, p99, error rate, pool saturation và giới hạn timeout.
