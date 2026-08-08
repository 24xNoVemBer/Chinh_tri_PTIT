# Nhật ký triển khai: từ redesign Student đến production readiness

**Khoảng thời gian:** 24/07/2026 – 04/08/2026  
**Nhánh:** `feature/phase-0-contracts`  
**Commit hiện tại:** `92d88a7`

Tài liệu này tổng hợp những hạng mục đã triển khai kể từ khi bắt đầu redesign
không gian sinh viên cho đến lớp backend/database hiện tại. Đây là bản ghi
implementation, không thay thế checklist nghiệm thu staging của PTIT.

## 1. Redesign trải nghiệm Student

### Trang chủ PTIT Chính Trị

- Đổi định vị từ “chatbot” thành **PTIT Chính Trị**, trong đó AI chỉ là trợ
  giảng hỗ trợ việc học.
- Xây dựng hero section theo hướng Khanmigo/Khan Academy: tiêu đề ngắn, CTA rõ,
  bố cục ít lề thừa và responsive.
- Thêm carousel các học phần/chủ đề chính trị, tự chuyển slide, trạng thái pause
  và animation vào trang.
- Bổ sung hình ảnh minh họa theo môn học và chủ đề: thư viện, lớp học, Marx –
  Engels, Hồ Chí Minh, lịch sử Việt Nam; thêm attribution cho các asset cần ghi
  nguồn.
- Chuẩn hóa tone PTIT: nền sáng, xanh navy, đỏ PTIT, typography formal hơn và
  giảm các tiêu đề quá lớn.
- Thêm các section giới thiệu học phần, tài liệu chính thống, hỏi đáp theo môn,
  ôn tập và phân tích luận điểm; nội dung tập trung vào sinh viên.

### Đăng nhập và phân luồng tài khoản

- Thiết kế lại trang đăng nhập để đồng bộ với trang chủ: màu sắc, font, CTA,
  thông điệp formal và layout hai vùng.
- Không yêu cầu người dùng chọn “sinh viên/giảng viên” trên giao diện; role lấy
  từ tài khoản đăng nhập và mở đúng luồng.
- Bổ sung tài khoản demo cho hai role ở môi trường development.

### Dashboard và học phần

- Student dashboard có tiếp tục học, học phần của tôi, tiến độ, câu hỏi gần đây,
  hoạt động và thống kê tổng quan.
- Lecturer dashboard có lớp phụ trách, sinh viên, câu hỏi chờ xử lý, review RAG,
  audit log và các chỉ số lớp.
- Thay sidebar cũ bằng top navigation theo hướng đã chốt; navbar có tìm kiếm,
  trợ giảng, thông báo, profile và logout.
- Tạo `CourseCover`, `AnimatedNumber`, progress bar và các card thống kê dùng lại
  giữa dashboard.
- Thay ảnh dashboard bằng ảnh minh họa gắn với từng môn học thay vì lặp ảnh PTIT.

### Hỏi đáp, tra cứu và chatbot

- Xây dựng trang lịch sử hỏi đáp/tra cứu theo context học phần.
- Sửa lỗi nội dung dài bị tràn ngang; card trả lời có wrap, citation, trạng thái
  chờ trả lời/đã trả lời và vùng dữ liệu demo rõ ràng.
- Chat page có context môn học, gợi ý câu hỏi, lịch sử hội thoại, trạng thái
  loading/error và link về học phần/tra cứu.
- Demo answer không còn đặt trực tiếp trong page; đi qua service/repository để
  sau này thay bằng RAG thật.
- Có luồng lecturer review câu trả lời RAG theo mức độ rủi ro và ghi nhận quyết
  định duyệt/từ chối.

## 2. Backend và contract RAG

- Hoàn thiện REST API cho auth, dashboard, subjects, lessons, questions, search,
  lecturer classes, review queue và audit logs.
- Bổ sung session cookie `ptit_session`, RBAC và kiểm tra quyền theo role/lớp.
- Tách contract chatbot thành các schema JSON/OpenAPI cho browser chat, RAG
  service và ingestion.
- Tạo RAG mock server, fixture và contract tests để frontend/backend làm việc
  trước khi nhận model thật.
- Thêm production RAG adapter với timeout, retry, token, health/readiness và
  live repository.
- Khi production bật `RAG_DEMO_DATA=false`, backend không tự rơi về citation/
  answer demo nếu RAG provider không khả dụng.
- Giữ nguyên HTTP contract để phía chatbot PTIT có thể bàn giao API rồi tích hợp
  mà không phải sửa lại UI flow.

## 3. Database và khả năng mở rộng

### Những gì đã làm

- DB-0: baseline schema, seed inventory, snapshot/rollback notes.
- DB-1: tách database client, query và transaction boundary khỏi repository.
- DB-2: neutral async query API và PostgreSQL pool adapter.
- DB-3: migration runner, checksum drift detection, export/import snapshot.
- DB-4A: chuyển auth/session/audit sang async query API.
- DB-4B: chuyển toàn bộ repository nghiệp vụ và live RAG sang async; transaction
  async hỗ trợ commit/rollback đúng khi callback trả Promise.
- AUTH-1: chuyển xác minh mật khẩu trong request đăng nhập từ `scryptSync` sang
  `crypto.scrypt` bất đồng bộ; giữ nguyên hash và HTTP contract.
- Runtime chọn database qua:

  ```text
  DATABASE_DRIVER=sqlite   # mặc định development
  DATABASE_DRIVER=postgres # dùng DATABASE_URL và pool PostgreSQL
  ```

- PostgreSQL không tự seed dữ liệu demo. Có thể export từ SQLite rồi import vào
  staging sau khi PTIT duyệt snapshot.

### Công cụ vận hành đã thêm

- `npm run db:baseline`
- `npm run db:migrate`
- `npm run db:export`
- `npm run db:import`
- `npm run db:validate:staging`
- `npm run db:credentials:staging`
- `npm run db:backup:staging` và `npm run db:restore:drill`
- PostgreSQL TLS `verify-full`, exact content fingerprint và parity/load fail-closed guards
- `npm run api:parity`
- `npm run load:test` và các profile `load:test:smoke|baseline|login-storm|exam-peak`

## 4. Kiểm thử và xác minh hiện tại

- Vitest: **26 test files, 141/141 tests passed**.
- ESLint: passed.
- Contract/OpenAPI validation: 9 schema, 4 examples và 3 OpenAPI documents
  passed.
- Production build bằng Vite: passed.
- API read parity và luồng write student → lecturer trên database disposable: passed.
- Load smoke local: 10 session, 5 active, 35/35 request thành công, 0 lỗi.

> Các số liệu local dùng SQLite, chỉ là baseline kỹ thuật. Chưa được dùng làm
> cam kết hiệu năng production.

## 5. Tài liệu đã bổ sung

- [Chatbot/backend integration contract](./CHATBOT_BACKEND_INTEGRATION.md)
- [Phase 0 contracts](../contracts/README.md)
- [DB-0 baseline](./PHASE_DB0_BASELINE.md)
- [DB-1 database client](./PHASE_DB1_DATABASE_CLIENT.md)
- [DB-2 query API](./PHASE_DB2_QUERY_API.md)
- [DB-3 PostgreSQL migration](./PHASE_DB3_POSTGRES_MIGRATION.md)
- [DB-4A async auth](./PHASE_DB4A_ASYNC_AUTH_PILOT.md)
- [DB-4B async repositories](./PHASE_DB4B_ASYNC_REPOSITORIES.md)
- [API parity staging check](./API_PARITY.md)
- [API load test](./LOAD_TEST.md)
- [DB-5 PostgreSQL staging cutover](./PHASE_DB5_POSTGRES_STAGING.md)
- [DB-5.5 backup/restore drill](./PHASE_DB5_BACKUP_RESTORE.md)
- [AUTH-1 async password verification](./PHASE_AUTH1_ASYNC_PASSWORD.md)

## 6. Trạng thái production readiness

### Đã sẵn sàng ở mức code

- Backend có thể chạy SQLite development hoặc PostgreSQL qua runtime config.
- Repository/API đã có async boundary để dùng connection pool.
- Có migration, snapshot import/export, readiness check, API parity và load-test
  tooling.
- UI demo và RAG contract có thể chạy độc lập trước khi model thật được bàn giao.

### Chưa thể coi là nghiệm thu production

1. Chưa chạy migration/import trên PostgreSQL staging thật của PTIT.
2. Chưa đối chiếu API parity với dữ liệu staging không phải fixture.
3. Chưa có số liệu PostgreSQL staging cho 1.000 session với 100–200 active, gồm p95/p99, pool saturation và error rate.
4. Chưa chạy profile 2.000–3.000 session với tối đa 500 active trong cửa sổ bảo trì được giám sát.
5. Chưa xác nhận Outlook SSO và chính sách tài khoản edu trên môi trường thật.
6. Chưa có backup/restore drill và phê duyệt rollback/cutover từ hạ tầng PTIT.
7. RAG model thật vẫn cần endpoint, auth, timeout, citation và policy dữ liệu từ
   đội chatbot PTIT.

## 7. Quy trình tiếp theo

```text
Cấp PostgreSQL staging + credential test
→ xác nhận database/user/host bằng truy vấn chỉ đọc
→ export + hash + offline dry-run snapshot staging-safe
→ npm run db:migrate
→ npm run db:import
→ npm run db:validate:staging với exact snapshot
→ npm run db:credentials:staging cho đúng hai tài khoản parity
→ npm run api:parity
→ load baseline 1.000 session và exam peak 2.000–3.000
→ đo p95/p99, pool và error rate (RAG đo riêng)
→ backup/restore + rollback drill
→ phê duyệt cutover production
```

Không đưa password, connection string hoặc token thật vào Git. Chỉ đặt chúng
trong environment/secret manager của máy hoặc server chạy kiểm thử.

## 8. Các commit chính

| Commit    | Nội dung                                                              |
| --------- | --------------------------------------------------------------------- |
| `2a6d080` | Redesign trải nghiệm trang chủ Student và course visuals ban đầu      |
| `44c686d` | Redesign trang đăng nhập                                              |
| `8b84f31` | Redesign dashboard, navbar, course covers, stats và assets            |
| `1a11d21` | Kết nối demo chat với risk-based lecturer review                      |
| `699c377` | Tài liệu contract tích hợp chatbot/backend                            |
| `3c774a6` | Phase 0 chatbot contracts và RAG mock                                 |
| `c703483` | Production RAG adapter foundation                                     |
| `1eadb68` | Live RAG repository cho student chat                                  |
| `8cde262` | Test live chat với seeded RAG mock                                    |
| `92d88a7` | Async backend, PostgreSQL runtime, staging validation và load tooling |
