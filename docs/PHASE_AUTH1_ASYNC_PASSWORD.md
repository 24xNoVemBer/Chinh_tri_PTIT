# AUTH-1 — Xác minh mật khẩu bất đồng bộ

**Ngày:** 2026-08-08

**Trạng thái:** hoàn tất ở mức code và kiểm thử local

**Phạm vi:** loại `scryptSync` khỏi request path đăng nhập, không đổi HTTP contract hoặc dữ liệu mật khẩu hiện có.

## Vấn đề đã xử lý

Trước AUTH-1, `POST /api/auth/login` gọi `scryptSync` để xác minh mật khẩu. `scrypt`
là phép tính cố ý tốn CPU; bản đồng bộ giữ event loop của Node cho đến khi hoàn tất.
Khi nhiều người đăng nhập cùng lúc, health check và các request không liên quan cũng có
thể phải chờ.

## Thay đổi

- Thêm `verifyPasswordAsync()` trong `server/auth.js`.
- Dùng `crypto.scrypt` dạng callback, để phép dẫn xuất khóa chạy qua worker pool của Node
  thay vì trên event loop.
- Route đăng nhập `await` kết quả xác minh trước khi tạo session.
- Giữ nguyên định dạng hash `scrypt$<salt>$<128 ký tự hex>`, vì vậy không cần đổi hoặc
  tạo lại mật khẩu đã lưu.
- Từ chối hash sai thuật toán, thiếu thành phần, sai độ dài, không phải hex hoặc salt quá
  lớn trước khi khởi chạy phép dẫn xuất khóa.
- Vẫn so sánh khóa bằng `timingSafeEqual` sau khi đã xác nhận độ dài.

`hashPassword()` tiếp tục dùng `scryptSync` cho seed và tác vụ quản trị chạy ngoài request
path. Không còn lời gọi xác minh đồng bộ nào trong `server/app.js`.

## Kiểm thử

- Mật khẩu đúng/sai với hash hiện có.
- 9 dạng hash không hợp lệ và bảo đảm không khởi chạy key derivation.
- Bảo đảm verifier chờ Promise bất đồng bộ thay vì hoàn tất đồng bộ.
- 8 lượt xác minh đồng thời có thể chờ độc lập.
- Full regression: **26 test files, 141/141 tests passed**.

## Giới hạn và bước xác minh tiếp theo

AUTH-1 loại điểm chặn event loop nhưng chưa phải bằng chứng hệ thống chịu được 1.000 lượt
đăng nhập. `crypto.scrypt` dùng worker pool của tiến trình Node; các lượt vượt sức chứa sẽ
được xếp hàng. Cần chạy profile `login-storm` trên PostgreSQL staging thật và theo dõi:

- p95/p99 của login và các API không liên quan trong cùng thời điểm;
- event-loop delay, CPU, RAM và độ sâu hàng đợi;
- PostgreSQL pool saturation và error rate;
- cấu hình số instance Node/load balancer trước khi điều chỉnh `UV_THREADPOOL_SIZE`.

Outlook SSO của PTIT là luồng xác thực production dự kiến và sẽ được thiết kế ở phase
riêng. Password login hiện tại vẫn được giữ an toàn cho demo, parity và môi trường staging.
