# AUTH-2 — Bảo vệ endpoint đăng nhập

**Ngày:** 2026-08-08

**Trạng thái:** hoàn tất ở mức code và kiểm thử local

**Phạm vi:** chặn brute-force/login storm trước bước `scrypt`, chia sẻ trạng thái giữa
nhiều backend instance và chuẩn bị đầu vào cho Outlook SSO PTIT.

## Kiến trúc đã triển khai

- Mỗi lần đăng nhập giữ ngân sách ở hai scope:
  - tài khoản: tối đa 20 lần trong 15 phút;
  - cặp địa chỉ nguồn–tài khoản: tối đa 5 lần trong 15 phút.
- Scope được băm SHA-256; bảng `auth_login_limits` không chứa email hoặc IP thô.
- Việc giữ lượt dùng một câu `INSERT ... ON CONFLICT ... RETURNING`, nên nguyên tử trên
  PostgreSQL và không phụ thuộc RAM của từng Node instance.
- Đăng nhập hợp lệ xóa cả hai scope. Lần thử sai hoặc sai role tiếp tục giữ ngân sách.
- Tài khoản không tồn tại vẫn chạy với một dummy scrypt hash để giảm rò rỉ qua thời gian
  phản hồi.
- Dữ liệu cũ được dọn theo chu kỳ; row đang bị chặn chưa hết hạn không bị xóa.
- Các profile load test tải cao bắt buộc đọc pool tài khoản riêng từ file secret và có ít nhất
  một credential cho mỗi worker đồng thời; generator không còn mô phỏng 1.000 người bằng một
  tài khoản duy nhất.

SQLite dùng cùng hành vi cho development. Production nhiều instance phải dùng PostgreSQL đã
chạy migration `002_auth-login-limits.sql`.

## HTTP contract

Khi vượt giới hạn:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 900
RateLimit-Policy: 5;w=900
```

```json
{
  "error": {
    "code": "AUTH_RATE_LIMITED",
    "message": "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
    "retryable": true
  }
}
```

## Reverse proxy

`AUTH_TRUST_PROXY=false` là mặc định an toàn. Chỉ đặt `true` khi backend đứng sau reverse
proxy/load balancer do PTIT kiểm soát và proxy **ghi đè** `X-Forwarded-For` từ client. Nếu
proxy chỉ nối tiếp header do client gửi, kẻ tấn công có thể giả địa chỉ nguồn.

Rate limit theo tài khoản vẫn hoạt động khi không trust proxy. Thiết kế không đặt hạn mức chỉ
theo IP để tránh khóa hàng loạt sinh viên cùng đi qua NAT của ký túc xá hoặc mạng trường.

## Cấu hình

| Biến                             | Mặc định | Ý nghĩa                                    |
| -------------------------------- | -------: | ------------------------------------------ |
| `AUTH_RATE_LIMIT_ENABLED`        |   `true` | Bắt buộc bật ở production                  |
| `AUTH_TRUST_PROXY`               |  `false` | Tin địa chỉ đầu tiên trong X-Forwarded-For |
| `AUTH_LOGIN_WINDOW_MS`           | `900000` | Cửa sổ cố định                             |
| `AUTH_LOGIN_BLOCK_MS`            | `900000` | Thời gian chặn                             |
| `AUTH_LOGIN_ACCOUNT_MAX`         |     `20` | Ngân sách trên tài khoản                   |
| `AUTH_LOGIN_SOURCE_ACCOUNT_MAX`  |      `5` | Ngân sách trên cặp nguồn–tài khoản         |
| `AUTH_LOGIN_CLEANUP_INTERVAL_MS` | `300000` | Chu kỳ kiểm tra và dọn row hết hạn         |

## Giới hạn và vận hành

- Đây là lớp bảo vệ backend; WAF/load balancer PTIT vẫn nên có connection/request rate limit
  trước Node.
- Rate limit không thay thế monitoring, CAPTCHA theo rủi ro hoặc chính sách khóa tài khoản của
  Microsoft Entra ID.
- Không thay đổi các ngưỡng production trước khi đo profile `login-storm` trên staging.
- Sau deploy migration cần kiểm tra số row, tỷ lệ 401/429, p95/p99 login, event-loop delay và
  PostgreSQL pool saturation.

## Kiểm thử local

- Hạn mức theo source–account và theo account dùng chung giữa nhiều limiter instance.
- 10 lượt giữ chỗ đồng thời chỉ có đúng số lượt trong ngân sách được phép tiếp tục.
- Reset sau credential hợp lệ, mở cửa sổ mới, cleanup row cũ và scope không chứa PII thô.
- HTTP 401/429, retry headers và production config fail-closed.
- Credential pool load test: số lượng tối thiểu, email trùng và secret file không hợp lệ.
- Full regression: **28 test files, 157/157 tests passed**.

Thông tin cần bàn giao để triển khai SSO được chốt tại
[OUTLOOK_SSO_INTEGRATION.md](./OUTLOOK_SSO_INTEGRATION.md).
