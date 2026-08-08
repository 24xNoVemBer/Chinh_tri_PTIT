# Contract tích hợp Outlook SSO PTIT

## Mục tiêu

Thay password login production bằng Microsoft Entra ID của PTIT, dùng tài khoản email giáo dục
để xác thực và ánh xạ người dùng vào luồng sinh viên hoặc giảng viên. Backend vẫn phát hành
session cookie `ptit_session`; frontend và chatbot không trực tiếp giữ access token Microsoft.

## Luồng đề xuất

1. Trình duyệt gọi `GET /api/auth/sso/login?returnTo=/student`.
2. Backend tạo `state`, `nonce` và PKCE, lưu giao dịch đăng nhập ngắn hạn rồi chuyển hướng tới
   endpoint authorize của tenant PTIT.
3. Microsoft chuyển về `GET /api/auth/sso/callback?code=...&state=...`.
4. Backend đối chiếu state, đổi code ở token endpoint, xác minh chữ ký và toàn bộ claim ID token.
5. Backend tìm hoặc tạo liên kết tài khoản bằng cặp bất biến `tid + oid`, lấy role từ nguồn PTIT
   đã thống nhất, tạo session nội bộ rồi redirect về `returnTo` đã nằm trong allowlist.
6. Các API nghiệp vụ tiếp tục dùng `GET /api/auth/me` và RBAC hiện có.

Luồng phải là Authorization Code + PKCE, tenant-specific; không dùng implicit flow và không coi
đuôi email `@ptit.edu.vn` là bằng chứng phân quyền.

## Thông tin đội PTIT cần bàn giao

### Microsoft Entra ID

- Tenant ID và issuer tenant-specific.
- Application/Client ID dành riêng cho từng môi trường staging và production.
- Redirect URI chính xác cho từng môi trường.
- Client credential: ưu tiên certificate; nếu dùng secret phải bàn giao qua secret manager, kèm
  ngày hết hạn và người chịu trách nhiệm rotation.
- URL OpenID configuration/JWKS hoặc xác nhận dùng discovery chuẩn của tenant.
- Chính sách Conditional Access/MFA áp dụng cho ứng dụng.
- Front-channel/back-channel logout URL nếu PTIT yêu cầu single logout.

### Claim và danh tính

- Ví dụ ID token đã loại chữ ký/PII nhạy cảm nhưng giữ tên claim.
- Claim bắt buộc: `iss`, `aud`, `tid`, `oid`, `sub`, `exp`, `iat`, `nonce`.
- Claim hiển thị: `name`, `preferred_username` hoặc email chính thức.
- Nguồn sự thật xác định sinh viên/giảng viên: app role, group ID, directory riêng hay API đào
  tạo. Cần cung cấp ID bất biến, không chỉ tên group.
- Quy tắc cho tài khoản khách, cựu sinh viên, tài khoản bị khóa và người vừa đổi vai trò.
- Thuộc tính dùng để nối với dữ liệu lớp: mã sinh viên/mã cán bộ và API/claim cung cấp thuộc tính
  đó.

### Hạ tầng và vận hành

- Domain public, TLS certificate và đường đi qua reverse proxy/load balancer.
- Secret manager, owner và lịch rotation credential.
- Mốc thời gian Entra ID, DNS và NTP; clock skew được phép.
- SLA/token endpoint timeout, maintenance contact và quy trình incident.
- Log retention, audit requirement và đầu mối xử lý dữ liệu cá nhân.

## Contract backend dự kiến

| Method | Endpoint                 | Kết quả                                               |
| ------ | ------------------------ | ----------------------------------------------------- |
| `GET`  | `/api/auth/sso/login`    | 302 tới Microsoft authorize endpoint                  |
| `GET`  | `/api/auth/sso/callback` | Xác minh code, tạo session, 302 về allowlisted return |
| `GET`  | `/api/auth/me`           | User/role hiện tại; giữ contract đang có              |
| `POST` | `/api/auth/logout`       | Hủy session nội bộ; có thể trả logout URL Entra       |
| `GET`  | `/api/auth/sso/status`   | Chỉ báo provider đã cấu hình, không lộ secret         |

Các mã lỗi tối thiểu: `SSO_NOT_CONFIGURED`, `SSO_STATE_INVALID`, `SSO_TOKEN_EXCHANGE_FAILED`,
`SSO_TOKEN_INVALID`, `SSO_TENANT_DENIED`, `SSO_ACCOUNT_NOT_LINKED`, `SSO_ROLE_UNRESOLVED`.
Thông báo trình duyệt không được phản chiếu raw error/token từ Microsoft.

## Yêu cầu xác minh token

- Chữ ký theo JWKS hiện hành và thuật toán allowlist.
- `iss` đúng issuer tenant PTIT; `tid` đúng tenant được cấp.
- `aud` đúng client ID của môi trường.
- `exp`, `nbf`, `iat`, `nonce`, `state` và PKCE verifier hợp lệ.
- Chống replay cho authorization code và state; state hết hạn tối đa 10 phút.
- JWKS được cache có TTL, refresh khi gặp `kid` mới và không gọi discovery trên mỗi login.
- Không ghi authorization code, token, secret, cookie hoặc claim nhạy cảm vào log.

## Thay đổi dữ liệu cần duyệt ở phase triển khai SSO

Không dùng email làm khóa liên kết. Migration SSO cần bảng/field chứa tối thiểu:

- `provider = microsoft-entra`;
- `tenant_id` (`tid`);
- `object_id` (`oid`), unique cùng tenant;
- `user_id` nội bộ;
- thời điểm liên kết/đăng nhập cuối và trạng thái liên kết.

Role và enrollment vẫn thuộc dữ liệu nghiệp vụ PTIT; không tự nâng quyền chỉ vì token có email
hợp lệ. Khi role chưa xác định, từ chối session bằng `SSO_ROLE_UNRESOLVED` và ghi audit không
chứa token.

## Tiêu chí nghiệm thu trước production

- Đăng nhập thành công cho ít nhất một sinh viên và một giảng viên staging.
- Tài khoản tenant khác, guest, token sai audience/issuer/nonce đều bị từ chối.
- Redirect ngoài allowlist bị từ chối.
- Rotation secret/certificate không cần build lại ứng dụng.
- Logout, session expiry, account disable và role change được kiểm thử.
- Profile 1.000 session và cao điểm 2.000–3.000 không gọi JWKS/discovery theo từng request.
- Security review xác nhận không có Microsoft token trong browser storage, database nghiệp vụ
  hoặc log.
