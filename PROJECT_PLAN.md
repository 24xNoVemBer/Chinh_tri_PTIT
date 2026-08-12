# Kế hoạch phát triển nền tảng hỗ trợ giảng dạy Chính trị PTIT

> **Cập nhật 12/08/2026:** Plan A quản trị môn học và lớp tín chỉ đã hoàn thành ở mức code và
> development. Phạm vi hiện tại gồm Admin, phân công nhiều giảng viên trên một lớp, ngân hàng câu
> hỏi dùng chung/riêng, hàng đợi hỏi đáp theo lớp, thống kê lớp và seed demo quy mô lớn. Xem
> [kế hoạch quản trị](./docs/ADMIN_CLASS_MANAGEMENT_PLAN.md) và
> [báo cáo nghiệm thu Phase 9](./docs/PHASE_ADMIN9_HARDENING.md). PostgreSQL staging thật, Outlook
> SSO và RAG thật vẫn là các cổng tích hợp bên ngoài repository.

## 1. Mục tiêu sản phẩm

Xây dựng nền tảng phục vụ hai mục đích chính:

1. Hỗ trợ **giảng viên quản lý lớp học**, sinh viên, bài học, học liệu, câu hỏi và tiến độ.
2. Hỗ trợ **sinh viên tra cứu kiến thức và hỏi đáp** theo môn học, bài học và nguồn tài liệu.

Quiz, báo cáo nâng cao và các tính năng LMS mở rộng là chức năng bổ trợ, không phải trục chính của MVP.

### Hai luồng cốt lõi

- **Giảng viên:** mở lớp → xem danh sách sinh viên → quản lý bài học và học liệu → tiếp nhận và trả lời câu hỏi → theo dõi tình hình lớp.
- **Sinh viên:** mở môn học → tìm kiếm hoặc đặt câu hỏi → xem câu trả lời và nguồn liên quan → xem lại lịch sử tra cứu.

### Trạng thái RAG

- Hệ thống RAG đã được hoàn thành ở phạm vi riêng.
- Repository frontend hiện tại chưa tích hợp với RAG.
- Trong các giai đoạn đầu, luồng tra cứu–hỏi đáp sử dụng mock service hoặc adapter.
- RAG chỉ được kết nối sau khi giao diện, routing, nghiệp vụ lớp học và contract API đã ổn định.
- Kế hoạch này không bao gồm việc xây dựng lại pipeline RAG.

## 2. Hiện trạng ban đầu (trước triển khai)

### Đã có

- React, Vite và React Router.
- Màn chọn vai trò sinh viên hoặc giảng viên.
- Layout cơ bản cho hai vai trò.
- Dữ liệu mẫu cho người dùng, lớp học, chương, bài học, quiz, câu hỏi, phản hồi AI và trích dẫn.
- Một số component dùng chung: thanh điều hướng, sidebar, trạng thái kiểm duyệt và tiến độ.
- Production build có thể biên dịch thành công.
- RAG đã hoàn thành bên ngoài repository và sẵn sàng để tích hợp ở giai đoạn sau.

### Vấn đề cần xử lý

#### P0 — Chặn luồng sử dụng

- Menu sinh viên trỏ tới các route chưa được khai báo.
- Tất cả mục sidebar giảng viên cùng trỏ tới `/lecturer` và cùng ở trạng thái active.
- Phần lớn màn hình mới là placeholder, chưa sử dụng dữ liệu mẫu.
- Repository frontend chưa có API tích hợp, xác thực hoặc phân quyền thật.
- Vai trò chỉ được ghi vào `localStorage` nhưng chưa được dùng để bảo vệ route.
- Các tệp PDF được dữ liệu mẫu tham chiếu chưa tồn tại trong repository.

#### P1 — Chất lượng và khả năng mở rộng

- Một số design token được dùng sai ngữ nghĩa, gây nền xám đậm và màu chữ tương phản thấp.
- Chưa có responsive breakpoint và điều hướng mobile.
- Chưa có loading, empty, error và permission state.
- Chưa có lint, formatter, unit test hoặc end-to-end test.
- Chưa tách bundle theo route.
- Page component đang phụ thuộc trực tiếp vào dữ liệu cục bộ thay vì service layer.

#### P2 — Hoàn thiện sản phẩm

- Thuộc tính ngôn ngữ HTML chưa đặt thành tiếng Việt.
- Favicon đang tham chiếu tệp không tồn tại.
- Chưa có metadata cơ bản.
- Chưa có tài liệu thiết lập môi trường và quy ước phát triển.
- Workspace chưa có Git repository hoạt động.

## 2.1. Tiến độ triển khai — 24/07/2026

- **Giai đoạn 0 — Contract và nền tảng:** hoàn thành. Đã khởi tạo Git, bổ sung README, contract frontend, lint, formatter và test runner.
- **Giai đoạn 1 — Nền tảng frontend:** hoàn thành. Routing, navigation, role guard, design token, responsive layout, trạng thái dữ liệu và route code-splitting đã hoạt động.
- **Giai đoạn 2 — Quản lý lớp cho giảng viên:** hoàn thành. Dashboard lớp, sinh viên, tiến độ, lịch bài học, học liệu, hộp thư câu hỏi và trả lời thủ công đã chuyển sang API thật.
- **Giai đoạn 3 — Tra cứu và hỏi đáp cho sinh viên:** hoàn thành. Dashboard, tiến độ môn/bài, tra cứu có phạm vi, nguồn tham khảo, hỏi đáp và lịch sử đã chuyển sang API thật.
- **Giai đoạn 4 — Backend, xác thực và dữ liệu thật:** hoàn thành ở mức MVP cục bộ. Đã có Node HTTP API, SQLite schema/seed, session cookie HttpOnly, password scrypt, RBAC tại endpoint và audit log append-only.
- **Persistence:** lớp, thành viên, lịch bài, học liệu/phiên bản, câu hỏi, câu trả lời, tiến độ và lịch sử tra cứu được lưu vào SQLite; test xác nhận dữ liệu còn sau khi đóng/mở lại database.
- **Tích hợp frontend:** page component gọi repository facade; production dùng API repository, còn mock repository chỉ giữ cho test/contract. Màn chọn vai trò đã được thay bằng đăng nhập thật.
- **Kiểm chứng:** Prettier và ESLint sạch, 24/24 test vượt qua, production build thành công; QA trình duyệt đã kiểm tra đăng nhập hai vai trò, tra cứu, route guard, 375 px và landscape 812×375 không tràn ngang.
- **Checkpoint hiện tại:** chờ review **Giai đoạn 4 — Backend, xác thực và dữ liệu thật** trước khi bắt đầu Giai đoạn 5.
- **RAG:** giữ trạng thái đã hoàn thành ở hệ thống riêng và chưa tích hợp trong checkpoint này.

## 3. Phạm vi MVP

### Giảng viên — Quản lý lớp

- Xem dashboard lớp học.
- Tạo hoặc xem danh sách lớp.
- Xem, tìm kiếm và quản lý danh sách sinh viên trong lớp.
- Quản lý nội dung bài học ở mức cơ bản.
- Quản lý học liệu và phiên bản tài liệu.
- Xem, lọc và trả lời câu hỏi của sinh viên.
- Theo dõi tiến độ và tình hình hoạt động của lớp.
- Kiểm tra, sửa hoặc duyệt câu trả lời do RAG tạo sau khi tích hợp.

### Sinh viên — Tra cứu và hỏi đáp

- Xem dashboard và các môn đang tham gia.
- Tra cứu kiến thức theo từ khóa, môn học hoặc bài học.
- Đặt câu hỏi trong ngữ cảnh môn học hoặc bài học.
- Xem câu trả lời, nguồn tham khảo và trạng thái kiểm duyệt khi có.
- Xem lại lịch sử câu hỏi và kết quả tra cứu.
- Xem bài học và tiến độ cơ bản.

### Hệ thống

- Phân quyền sinh viên và giảng viên.
- Cung cấp contract ổn định giữa UI, mock service, backend và RAG.
- Lưu lịch sử câu hỏi, kết quả tra cứu và hoạt động quản lý lớp.
- Không hiển thị nhãn “Đã duyệt” khi chưa có thao tác của giảng viên.
- Khi tích hợp RAG, ghi nhận nguồn, phiên bản tài liệu, trang và đoạn trích cho mỗi câu trả lời.

## 4. Kiến trúc thông tin

### Khu vực sinh viên

```text
/student
├── dashboard
├── subjects
│   └── :subjectId
│       ├── overview
│       ├── lessons
│       │   └── :lessonId
│       ├── search
│       ├── qna
│       └── progress
├── search
├── question-history
└── notifications
```

### Khu vực giảng viên

```text
/lecturer
├── dashboard
├── classes
│   └── :classId
│       ├── overview
│       ├── students
│       ├── lessons
│       ├── materials
│       ├── questions
│       └── progress
└── review-queue
```

## 5. Kiến trúc frontend đề xuất

```text
src/
├── app/
│   ├── router/
│   └── providers/
├── components/
│   ├── common/
│   └── feedback/
├── features/
│   ├── auth/
│   ├── classes/
│   ├── students/
│   ├── subjects/
│   ├── lessons/
│   ├── materials/
│   ├── search/
│   ├── questions/
│   └── progress/
├── layouts/
├── services/
│   ├── api/
│   ├── repositories/
│   └── rag/
├── mocks/
├── styles/
└── test/
```

### Nguyên tắc

- Component không import trực tiếp mock data.
- Trang gọi repository hoặc service có interface ổn định.
- Mock service và API thật cùng tuân theo một contract.
- RAG adapter tuân theo contract hỏi đáp và có thể gắn vào sau mà không đổi page component.
- Route được lazy-load theo khu vực hoặc feature.
- Trạng thái server và trạng thái UI được tách riêng.
- Mỗi feature chứa component, hook, schema và test liên quan.

## 6. Mô hình dữ liệu chính

Các thực thể cần được chuẩn hóa:

- `User`
- `Role`
- `Subject`
- `CourseClass`
- `Enrollment`
- `Chapter`
- `Lesson`
- `Material`
- `MaterialVersion`
- `StudentQuestion`
- `ManualAnswer`
- `SearchHistory`
- `LearningProgress`
- `AIResponse`
- `Citation`
- `LecturerReview`
- `AuditEvent`

### Trạng thái câu hỏi

```text
open → answered
     ↘ waiting_for_rag
     ↘ waiting_for_lecturer
     ↘ closed
```

### Trạng thái câu trả lời RAG sau khi tích hợp

```text
generated → pending_review → approved
                           ↘ rejected
                           ↘ needs_revision
```

Mỗi lần sửa hoặc thay đổi trạng thái phải tạo audit event, không ghi đè lịch sử.

## 7. Roadmap triển khai

### Giai đoạn 0 — Chốt phạm vi và hợp đồng tích hợp

**Thời lượng:** 0,5–1 ngày

#### Công việc

- Chốt hai use case cốt lõi: quản lý lớp và tra cứu–hỏi đáp.
- Chốt route map.
- Chuẩn hóa schema dữ liệu.
- Chốt contract cho class service, search service và question service.
- Ghi nhận contract đầu vào/đầu ra của hệ thống RAG đã hoàn thành.
- Viết acceptance criteria cho hai vertical slice.

#### Hoàn thành khi

- Có product brief ngắn và route map ổn định.
- Contract frontend không phụ thuộc implementation của RAG.
- Nhóm thống nhất phần nào thuộc MVP và phần nào bị hoãn.

### Giai đoạn 1 — Sửa nền móng frontend

**Thời lượng:** 1–2 ngày

#### Công việc

- Khởi tạo Git và tài liệu thiết lập dự án.
- Sửa toàn bộ route và navigation.
- Thêm route guard theo vai trò.
- Chuẩn hóa design token theo ngữ nghĩa.
- Sửa màu nền và các vấn đề tương phản.
- Tạo service/repository layer và mock adapters.
- Thêm lint, formatter và test runner.
- Đặt `lang="vi"`, favicon và metadata cơ bản.

#### Hoàn thành khi

- Không có link chết.
- Chỉ đúng menu hiện tại được active.
- Refresh trang không làm mất ngữ cảnh vai trò.
- Giao diện hoạt động ở desktop và mobile.
- Production build không có lỗi.

### Giai đoạn 2 — Quản lý lớp dành cho giảng viên

**Thời lượng:** 3–4 ngày

#### Công việc

- Dashboard giảng viên.
- Danh sách lớp và chi tiết lớp.
- Danh sách, tìm kiếm và trạng thái sinh viên.
- Quản lý bài học và học liệu ở mức MVP.
- Danh sách câu hỏi theo lớp, môn và trạng thái.
- Trả lời thủ công trước khi tích hợp RAG.
- Tiến độ và chỉ số lớp cơ bản.

#### Hoàn thành khi

- Giảng viên đi được từ dashboard đến một lớp cụ thể.
- Có thể xem và quản lý dữ liệu sinh viên, bài học và học liệu qua mock service.
- Có thể lọc, mở và trả lời một câu hỏi.
- Có loading, empty, error và permission state cho các màn chính.

### Giai đoạn 3 — Tra cứu và hỏi đáp dành cho sinh viên

**Thời lượng:** 3–4 ngày

#### Công việc

- Dashboard sinh viên và danh sách môn.
- Màn tra cứu theo từ khóa, môn và bài học.
- Trang kết quả có phân loại nội dung và nguồn tham khảo.
- Form đặt câu hỏi.
- Hiển thị câu trả lời từ mock question/search service.
- Lịch sử tra cứu và câu hỏi.
- Màn đọc bài học và tiến độ cơ bản.

#### Hoàn thành khi

- Sinh viên có thể tìm nội dung từ dashboard hoặc trong một môn học.
- Sinh viên có thể đặt câu hỏi và nhận câu trả lời mock.
- Có thể xem lại lịch sử câu hỏi và tra cứu.
- UI không phụ thuộc trực tiếp vào implementation của RAG.

### Giai đoạn 4 — Backend, xác thực và dữ liệu thật

**Thời lượng:** 3–5 ngày

#### Công việc

- Thiết kế API và database cho nghiệp vụ web.
- Tích hợp cơ chế xác thực phù hợp.
- Thêm role-based access control.
- Lưu lớp, thành viên, bài học, học liệu, câu hỏi và lịch sử tra cứu.
- Thay mock repository bằng API repository.
- Quản lý upload và phiên bản học liệu nếu backend web cần đảm nhiệm.
- Bổ sung audit log cho hoạt động quản lý lớp và trả lời câu hỏi.

#### Hoàn thành khi

- Dữ liệu tồn tại sau khi reload.
- Người dùng không truy cập được chức năng sai vai trò.
- Hai vertical slice chạy bằng dữ liệu thật mà không phải viết lại page component.
- Có thể truy vết ai đã tạo, sửa và trả lời câu hỏi.

### Giai đoạn 5 — Demo UI/UX cho luồng RAG

**Trạng thái:** Đã triển khai, chờ review

#### Phạm vi hiện tại

- Dùng fixture có nhãn `Dữ liệu demo · mô phỏng RAG`; không gọi model hoặc endpoint RAG thật.
- Hiển thị tách biệt câu trả lời mô phỏng, nguồn trích dẫn và trạng thái kiểm duyệt.
- Sinh viên xem được trạng thái chờ duyệt/đã duyệt và citation theo học liệu.
- Giảng viên có hàng đợi, màn đối chiếu nguồn, chỉnh nội dung, duyệt, yêu cầu sửa hoặc loại bỏ.
- Lưu quyết định kiểm duyệt và audit log trong SQLite để demo xuyên suốt hai vai trò.
- Kiểm tra responsive ở 375, 768, 1024 và 1440 px, loading/error/empty state và keyboard semantics.

#### Chưa thực hiện trong checkpoint này

- Không kết nối model RAG thật.
- Không triển khai timeout, retry, cancel hoặc streaming từ dịch vụ RAG.
- Không coi dữ liệu fixture là kết quả học thuật thật.

#### Hoàn thành khi

- Mọi nội dung mô phỏng đều có nhãn demo rõ ràng.
- Sinh viên phân biệt được câu trả lời mô phỏng, citation và câu trả lời trực tiếp của giảng viên.
- Giảng viên review được trọn luồng mà không cần model thật.
- Contract UI ổn định để gắn adapter RAG thật ở giai đoạn tích hợp sau mà không viết lại page.

### Giai đoạn 6 — Hardening và phát hành

**Thời lượng:** 2–3 ngày

#### Công việc

- Kiểm tra accessibility và keyboard navigation.
- Bổ sung `prefers-reduced-motion`.
- Kiểm tra responsive ở 375, 768, 1024 và 1440 px.
- Lazy-load route và tối ưu bundle.
- Unit test cho logic nghiệp vụ.
- Integration test cho service layer.
- End-to-end test cho hai luồng cốt lõi.
- Bổ sung logging và error boundary.
- Viết checklist triển khai và rollback.

#### Hoàn thành khi

- Hai core flow có end-to-end test.
- Không có lỗi accessibility nghiêm trọng.
- Không có route hoặc asset 404.
- Production build sạch và kích thước bundle hợp lý.
- Có hướng dẫn cấu hình, triển khai và rollback.

## 8. Hai luồng E2E bắt buộc

### Luồng giảng viên

```text
Chọn vai trò
→ mở danh sách lớp
→ mở một lớp
→ xem hoặc tìm sinh viên
→ quản lý bài học/học liệu
→ mở câu hỏi
→ trả lời
→ xác nhận trạng thái phía sinh viên
```

### Luồng sinh viên

```text
Chọn vai trò
→ mở môn học
→ tra cứu theo từ khóa
→ xem kết quả và nguồn
→ đặt câu hỏi
→ xem câu trả lời
→ xem lại lịch sử hỏi đáp
```

Sau khi tích hợp RAG, cùng luồng sinh viên phải được chạy lại với câu trả lời thật và citation thật.

## 9. Tiêu chí chất lượng chung

### UX và accessibility

- Điều hướng bàn phím đầy đủ.
- Focus indicator luôn nhìn thấy.
- Độ tương phản đạt yêu cầu WCAG AA cho nội dung chính.
- Không dùng màu sắc làm tín hiệu trạng thái duy nhất.
- Có loading, empty, error, success và permission state.
- Animation không bắt buộc và tôn trọng reduced motion.

### Quản lý lớp

- Dữ liệu của mỗi lớp được phân tách rõ ràng.
- Chỉ giảng viên có quyền mới được sửa dữ liệu lớp.
- Thao tác quan trọng có trạng thái thành công hoặc lỗi rõ ràng.
- Có thể truy vết các thay đổi quan trọng.

### Tra cứu, hỏi đáp và RAG

- UI vẫn hoạt động bằng mock/manual answer khi chưa tích hợp RAG.
- Sau khi tích hợp, không tạo citation giả và không sử dụng nguồn chưa được phê duyệt.
- Phân biệt rõ nội dung nguồn, RAG tổng hợp và giảng viên duyệt.
- Câu trả lời thiếu bằng chứng phải hiển thị trạng thái không chắc chắn hoặc chuyển cho giảng viên.
- Lưu phiên bản RAG, nguồn truy xuất và thời điểm sinh.

### Kỹ thuật

- Không import mock data trực tiếp trong page component.
- Không có route chết hoặc navigation không xác định.
- Không render HTML chưa được kiểm soát.
- Core logic có unit test.
- Core journey có end-to-end test.
- Production build và lint phải chạy trong CI.

## 10. Ngoài phạm vi MVP

Tạm hoãn:

- Xây dựng hoặc huấn luyện lại RAG.
- Quản trị hệ thống nhiều cấp.
- Điểm danh.
- Sổ điểm đầy đủ.
- Quiz nâng cao và ngân hàng đề lớn.
- Báo cáo nâng cao và xuất file.
- Thông báo realtime.
- Chat tự do ngoài ngữ cảnh môn học.
- Ứng dụng mobile native.
- Tích hợp sâu với hệ thống đào tạo PTIT trước khi MVP được xác nhận.

## 11. Ước lượng

Tổng ước lượng cho một developer: **13–21 ngày công**.

Trong đó, phần frontend-first trước khi tích hợp RAG khoảng **7–11 ngày công** cho giai đoạn 0–3.

Ước lượng không bao gồm:

- Thời gian xây dựng RAG vì hạng mục này đã hoàn thành.
- Thời gian xin quyền truy cập hệ thống PTIT.
- Tích hợp SSO thật nếu cần quy trình phê duyệt riêng.
- Làm sạch và xác minh toàn bộ kho giáo trình.
- Hạ tầng production và yêu cầu tuân thủ của nhà trường.

## 12. Thứ tự ưu tiên

1. Sửa routing, design token và cấu trúc nền tảng.
2. Hoàn thiện quản lý lớp dành cho giảng viên.
3. Hoàn thiện tra cứu và hỏi đáp dành cho sinh viên bằng mock/service contract.
4. Chuyển từ mock sang backend và dữ liệu thật.
5. Demo UI/UX RAG bằng fixture; tích hợp model thật sau khi review.
6. Hardening, kiểm thử và phát hành.
7. Chỉ bổ sung quiz hoặc tính năng LMS nâng cao sau khi hai mục đích chính hoạt động ổn định.

## 13. Database production hardening progress — 2026-08-04

- **DB-0:** baseline schema, seed inventory và rollback notes đã ghi nhận.
- **DB-1:** tách database client/transaction boundary khỏi repository.
- **DB-2:** bổ sung neutral query API và PostgreSQL pool adapter.
- **DB-3:** có PostgreSQL migration runner, checksum drift detection và data snapshot import/export.
- **DB-4A:** auth/session/audit chuyển qua async query API.
- **DB-4B:** toàn bộ repository nghiệp vụ, live RAG và runtime database wiring chuyển sang async; SQLite vẫn là default.

### Điều kiện để hoàn tất production cutover

1. Chạy migration và import trên PostgreSQL staging của PTIT.
2. Chạy API parity với dữ liệu staging, không seed dữ liệu demo.
3. Chạy load test 1.000 concurrent sessions và đợt cao điểm 2.000–3.000 người dùng.
4. Đo p95/p99 latency, pool saturation, error rate và kiểm thử rollback.
5. Có checklist vận hành, backup/restore và phê duyệt cutover.

### Công cụ chuẩn bị cho staging

- `npm run api:parity`: smoke test mặc định không đổi dữ liệu nghiệp vụ cho health/readiness và route đọc của hai vai trò; đăng nhập vẫn tạo session/audit.
- `npm run load:test`: tạo pool session, đo latency/TTFB/error rate theo endpoint với profile smoke, baseline, login-storm và exam-peak.
