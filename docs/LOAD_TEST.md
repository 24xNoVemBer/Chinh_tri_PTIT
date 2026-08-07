# API load test

`scripts/load-test.mjs` là capacity probe ở HTTP boundary cho backend PTIT Chính Trị.
Script tạo session thật, giữ cookie, sau đó dùng một nhóm session hoạt động để gọi các route GET
của sinh viên. Script không gọi chat, search ghi lịch sử hoặc RAG.

## Khái niệm

- `sessions`: số lần đăng nhập thành công cần tạo và giữ trong suốt lượt chạy.
- `active`: số session trong pool được dùng để phát sinh lượt đọc.
- `concurrency`: số request/worker tối đa chạy đồng thời; không đồng nghĩa với số session.
- `rounds`: số vòng mỗi active session gọi toàn bộ nhóm route đọc.
- `rampMs`: thời gian dàn các lượt login, tránh tạo burst ngoài ý muốn.
- `thinkTimeMs`: khoảng nghỉ giữa hai request của cùng active session.

Nhóm route đọc gồm `/api/auth/me`, dashboard, học phần, câu hỏi và lịch sử tra cứu.

## Profiles

| Profile       | Sessions | Active | Concurrency | Mục đích                            |
| ------------- | -------: | -----: | ----------: | ----------------------------------- |
| `smoke`       |       10 |      5 |           5 | Kiểm tra generator và deployment    |
| `baseline`    |    1.000 |    150 |         100 | Mức sử dụng thường xuyên dự kiến    |
| `login-storm` |      300 |      0 |         150 | Đo riêng pha đăng nhập trong 5 giây |
| `exam-peak`   |    3.000 |    500 |         200 | Mức cao điểm gần kỳ thi             |

Profile có thể được override bằng `--sessions`, `--active`, `--concurrency`, `--rounds`,
`--ramp-ms`, `--think-time-ms` và `--timeout-ms`. `--users` vẫn là alias cũ của `--sessions`.

## Smoke local

```powershell
npm run load:test:smoke -- --base-url http://127.0.0.1:3001
```

## Chạy trên staging

Credential remote bắt buộc lấy từ biến môi trường. Không commit hoặc đưa mật khẩu vào lịch sử
command dùng chung:

```powershell
$env:LOAD_TEST_BASE_URL = "https://staging.example.ptit.edu.vn"
$env:LOAD_TEST_EMAIL = "load-student@ptit.edu.vn"
$env:LOAD_TEST_PASSWORD = "..."
$env:LOAD_TEST_ALLOW_HIGH = "true"
$env:LOAD_TEST_CONFIRM_STAGING = "true"
$env:LOAD_TEST_CONFIRM_HOST = "staging.example.ptit.edu.vn"
$env:LOAD_TEST_MAX_REQUESTS = "20000"

npm run load:test:baseline
npm run load:test:exam-peak
```

Mọi lượt có trên 500 session, trên 200 active hoặc concurrency trên 100 bị chặn nếu thiếu đủ
`LOAD_TEST_ALLOW_HIGH=true`, `LOAD_TEST_CONFIRM_STAGING=true` và hostname xác nhận trùng chính
xác target. Generator tính trước `sessions + active × rounds × 5 routes`; nếu vượt
`LOAD_TEST_MAX_REQUESTS` (mặc định 20.000), lệnh dừng trước khi gửi request. Dùng `--dry-run` để
kiểm tra target, cấu hình và ngân sách request đã resolve:

```powershell
npm run load:test:baseline -- --dry-run
```

## Kết quả

Report JSON có:

- `runId`, thời gian bắt đầu/kết thúc, request dự kiến/trần request và cấu hình đã dùng;
- số session tạo thành công, active session và số credential phân biệt;
- attempted/succeeded/failed, error rate và status-code buckets;
- actual throughput của pha login, pha đọc và toàn lượt;
- total latency cùng TTFB, p50/p95/p99/max theo từng endpoint;
- tối đa 20 lỗi mẫu và threshold violations.

Threshold mặc định hiện là guard kỹ thuật tạm thời: error rate `1%`, login p95 `2.000 ms`,
read p95 `1.000 ms`. Chỉ coi là SLO chính thức sau khi chủ hệ thống và đội hạ tầng PTIT duyệt.

## Quy trình vận hành

1. Dùng database staging riêng, đã backup và có thể restore.
2. Chạy exact row-count/fingerprint validation và API parity trước load test.
3. Chạy generator từ host khác API server để không cạnh tranh CPU/RAM.
4. Ghi lại `runId`, start/end time; đối chiếu đồng thời CPU, RAM, network, `pg_stat_activity`,
   connection-pool waiting, lock và slow query.
5. Chạy lần lượt smoke, baseline, login storm rồi exam peak; dừng nếu error rate hoặc pool wait
   tăng liên tục.
6. Restore database disposable hoặc dọn session/audit theo retention policy sau khi đo.

Không chạy profile cao trên production. Guard `LOAD_TEST_CONFIRM_STAGING=true` chỉ được cấp cho
server/database staging disposable đã backup và có người giám sát.

## Giới hạn hiện tại

Generator hiện dùng một credential và closed-loop worker. Nó xác nhận khả năng giữ 1.000–3.000
session cùng nhóm 100–500 active, nhưng chưa thay thế benchmark open-arrival/soak dài hạn.
Khi staging PTIT sẵn sàng, cần bổ sung credential pool ngoài Git và bài đo target-RPS/soak để
loại coordinated omission. RAG được đo bằng playbook riêng sau khi backend chatbot bàn giao.
