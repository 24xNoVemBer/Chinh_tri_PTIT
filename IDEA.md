# Ý tưởng sản phẩm — PTIT Chính Trị

> Tài liệu định hướng ý tưởng, cơ sở hình thành kế hoạch và nguồn tham khảo cho dự án.
>
> Cập nhật: 31/07/2026

## 1. Vai trò của tài liệu

`IDEA.md` trả lời các câu hỏi:

- Sản phẩm giải quyết vấn đề gì và dành cho ai?
- Vì sao các luồng chức năng và hướng thiết kế hiện tại được lựa chọn?
- AI trợ giảng và RAG giữ vai trò gì trong sản phẩm?
- Những nguồn nào được dùng để tham khảo về nội dung, trải nghiệm và kỹ thuật?
- Các quyết định nào đã chốt, phần nào cần review tiếp?

Tài liệu này không thay thế [PROJECT_PLAN.md](./PROJECT_PLAN.md). `IDEA.md` tập trung vào
**ý tưởng và lý do**, còn `PROJECT_PLAN.md` tập trung vào **công việc, giai đoạn và tiêu chí
hoàn thành**.

## 2. Tóm tắt ý tưởng

**PTIT Chính Trị** là nền tảng học tập các học phần lý luận chính trị dành cho sinh viên
PTIT, đồng thời cung cấp không gian quản lý lớp và xử lý câu hỏi cho giảng viên.

AI trợ giảng là một năng lực hỗ trợ bên trong nền tảng, không phải tên gọi hay toàn bộ mục
đích của sản phẩm. Trải nghiệm chính vẫn là:

1. Sinh viên học theo học phần, theo dõi tiến độ, tra cứu tài liệu và đặt câu hỏi đúng ngữ
   cảnh.
2. Giảng viên quản lý lớp, bài học, học liệu, tiến độ và phản hồi câu hỏi.
3. Khi RAG được tích hợp, câu trả lời phải bám nguồn, có thể kiểm chứng và đi qua quy trình
   kiểm duyệt phù hợp.

### Câu mô tả ngắn

> Học các môn lý luận chính trị theo từng học phần, tra cứu học liệu và hỏi đáp với AI trợ
> giảng trong một không gian thống nhất.

## 3. Bối cảnh và vấn đề

### Đối với sinh viên

- Học liệu, giáo trình, văn kiện và ghi chú có thể nằm ở nhiều nơi.
- Việc tìm đúng phần kiến thức theo môn, chương hoặc bài học mất thời gian.
- Câu trả lời từ công cụ AI phổ thông có thể không bám giáo trình đang học và khó kiểm tra
  nguồn.
- Sinh viên khó nhận biết nên học tiếp nội dung nào hoặc câu hỏi của mình đã được phản hồi
  chưa.

### Đối với giảng viên

- Thông tin lớp, bài học, học liệu và câu hỏi thường phân tán ở nhiều công cụ.
- Khó nhận biết nhanh lớp nào, sinh viên nào hoặc câu hỏi nào cần ưu tiên.
- Nếu dùng AI để hỗ trợ trả lời, giảng viên cần biết nội dung dựa trên tài liệu nào và có
  quyền sửa, duyệt hoặc từ chối trước khi công bố.

### Cơ hội

Tạo một không gian học tập chuyên biệt, trong đó ngữ cảnh học phần là trục chính. Mọi thao
tác tra cứu, hỏi đáp và theo dõi tiến độ đều gắn với môn học, bài học và nguồn chính thống.

## 4. Người dùng và nhu cầu cốt lõi

| Nhóm người dùng | Nhu cầu chính                                      | Kết quả mong muốn                                                 |
| --------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Sinh viên       | Biết nên học gì tiếp theo                          | Tiếp tục bài đang học với ít thao tác                             |
| Sinh viên       | Tìm kiến thức trong đúng môn, chương và nguồn      | Nhận kết quả ngắn gọn, có trích dẫn và có thể mở nguồn            |
| Sinh viên       | Đặt câu hỏi và theo dõi phản hồi                   | Phân biệt rõ đang chờ, AI tổng hợp, giảng viên trả lời hoặc duyệt |
| Giảng viên      | Theo dõi lớp và công việc cần xử lý                | Thấy ngay câu hỏi, học liệu hoặc sinh viên cần chú ý              |
| Giảng viên      | Quản lý nội dung theo lớp                          | Bài học và tài liệu có cấu trúc, trạng thái và lịch sử rõ ràng    |
| Giảng viên      | Kiểm soát nội dung AI trước khi dùng trong học tập | Có nguồn đối chiếu, phiên bản, quyết định duyệt và audit log      |

Tài khoản quyết định vai trò và không gian được truy cập. Người dùng không chọn thủ công
“Sinh viên” hoặc “Giảng viên” sau khi đăng nhập.

## 5. Định vị sản phẩm

### Sản phẩm là

- Nền tảng học tập chuyên biệt cho các học phần lý luận chính trị tại PTIT.
- Không gian tra cứu và hỏi đáp theo ngữ cảnh học phần.
- Công cụ quản lý lớp và xử lý câu hỏi ở mức MVP cho giảng viên.
- Lớp giao diện sẵn sàng kết nối RAG qua contract ổn định.

### Sản phẩm không phải

- Một chatbot tự do có thể hỏi mọi chủ đề.
- Một hệ quản trị đào tạo thay thế toàn bộ LMS hoặc cổng đào tạo PTIT.
- Một hệ thống tự động công bố câu trả lời AI mà không có nguồn hoặc kiểm soát.
- Một kho tài liệu không xác định quyền sử dụng và phiên bản.
- Một công cụ chấm điểm hoặc đưa ra quyết định học vụ tự động.

## 6. Nguyên tắc sản phẩm

### 6.1. Ngữ cảnh trước, AI sau

Người dùng chọn học phần hoặc bài học trước khi hỏi. AI nhận ngữ cảnh từ hệ thống thay vì
buộc sinh viên lặp lại toàn bộ thông tin trong câu hỏi.

### 6.2. Hành động quan trọng xuất hiện trước

Dashboard sinh viên ưu tiên “Tiếp tục học”, việc hôm nay và phản hồi mới. Dashboard giảng
viên ưu tiên công việc cần xử lý và tình hình lớp, thay vì chỉ trình bày các con số trang
trí.

### 6.3. Nguồn là một phần của câu trả lời

Trích dẫn không nằm ở phần phụ tùy chọn. Người dùng phải biết nội dung đến từ giáo trình,
văn kiện hoặc học liệu nào, phiên bản nào và vị trí nào.

### 6.4. Con người giữ quyền quyết định

Giảng viên có quyền trả lời trực tiếp, sửa nội dung AI, duyệt, từ chối hoặc yêu cầu tạo lại.
Không hiển thị trạng thái “Đã duyệt” nếu chưa có thao tác thật của giảng viên.

### 6.5. Ngôn ngữ ngắn gọn và trang trọng

- Dùng “PTIT Chính Trị”, không gọi toàn bộ website là “chatbot”.
- Tiêu đề mô tả đúng hành động hoặc nội dung của màn hình.
- Tránh nội dung quảng cáo mơ hồ, thuật ngữ AI không cần thiết và tuyên bố vượt quá trạng
  thái thực tế.
- Nội dung demo phải có nhãn rõ ràng.

### 6.6. Giao diện học thuật, hiện đại và có kỷ luật

- Nền sáng, màu đỏ PTIT dùng cho hành động và trạng thái active.
- Mật độ vừa đến cao ở dashboard, thoáng hơn ở màn đọc và hỏi đáp.
- Hình ảnh phải liên quan trực tiếp đến học phần hoặc bối cảnh học tập.
- Motion giúp định hướng sự chú ý, không dùng để trang trí liên tục.

## 7. Hai vòng lặp giá trị cốt lõi

### 7.1. Vòng lặp của sinh viên

```text
Đăng nhập
→ xem việc học ưu tiên
→ mở học phần hoặc bài học
→ đọc hoặc tra cứu
→ đặt câu hỏi theo ngữ cảnh
→ xem nguồn và phản hồi
→ quay lại tiếp tục học
```

### 7.2. Vòng lặp của giảng viên

```text
Đăng nhập
→ xem công việc cần xử lý
→ mở lớp
→ kiểm tra tiến độ, bài học hoặc học liệu
→ mở câu hỏi
→ trả lời hoặc kiểm duyệt nội dung AI
→ công bố và lưu lịch sử quyết định
```

## 8. Kiến trúc trải nghiệm đề xuất

### 8.1. Trang giới thiệu

Trang chủ chủ yếu nói với sinh viên:

- PTIT Chính Trị giúp học rõ hơn theo từng học phần.
- Có thể tra cứu học liệu và hỏi AI trợ giảng theo đúng ngữ cảnh.
- Câu trả lời hướng tới việc gắn với nguồn chính thống.
- Nút chính dẫn tới đăng nhập; vai trò được xác định từ tài khoản.

Phần giảng viên chỉ nên xuất hiện ngắn ở cuối hoặc trong phần giải thích hệ sinh thái, không
chiếm trọng tâm hero.

### 8.2. Không gian sinh viên

```text
Tổng quan
├── Tiếp tục học
├── Việc hôm nay
├── Học phần của tôi
├── Phản hồi mới
└── Hỏi trợ giảng theo học phần

Học phần
├── Tổng quan
├── Chương và bài học
├── Tiến độ
├── Học liệu
└── Hỏi đáp theo học phần

Hỏi đáp
├── Câu hỏi của tôi
├── Trạng thái phản hồi
├── Câu trả lời và nguồn
└── Lịch sử tra cứu
```

### 8.3. Không gian giảng viên

```text
Tổng quan
├── Công việc cần xử lý
├── Tình hình lớp
├── Lớp đang giảng dạy
└── Hoạt động gần đây

Lớp học
├── Sinh viên
├── Bài học
├── Học liệu
├── Hỏi đáp
└── Tiến độ

Kiểm duyệt
├── Nội dung AI đang chờ
├── Nguồn đối chiếu
├── Chỉnh sửa
└── Duyệt, từ chối hoặc yêu cầu sửa
```

## 9. Ý tưởng tích hợp RAG

### Trạng thái

Hệ thống RAG đã được hoàn thành ở phạm vi riêng nhưng chưa kết nối vào repository này. Bản
web hiện dùng fixture hoặc dữ liệu demo để hoàn thiện UI/UX và quy trình kiểm duyệt trước.

### Contract tối thiểu đề xuất

#### Đầu vào

```json
{
  "studentId": "user-id",
  "subjectId": "subject-id",
  "lessonId": "lesson-id-or-null",
  "query": "Câu hỏi của sinh viên",
  "locale": "vi-VN"
}
```

#### Đầu ra

```json
{
  "answer": "Nội dung tổng hợp",
  "citations": [
    {
      "materialId": "material-id",
      "versionId": "version-id",
      "title": "Tên tài liệu",
      "page": 42,
      "excerpt": "Đoạn văn làm căn cứ"
    }
  ],
  "confidence": 0.82,
  "modelVersion": "model-version",
  "indexVersion": "index-version",
  "generatedAt": "ISO-8601",
  "traceId": "trace-id"
}
```

### Trạng thái kiểm duyệt

```text
generated
→ pending_review
→ approved
↘ needs_revision
↘ rejected
```

### Quy tắc hiển thị

- Không tạo citation giả khi RAG không trả về nguồn.
- Không dùng confidence như một bảo đảm “đúng”.
- Nội dung chưa duyệt phải có nhãn rõ ràng.
- Câu trả lời trực tiếp của giảng viên phải khác biệt với nội dung AI tổng hợp.
- Khi không đủ bằng chứng, giao diện phải nói rõ và hướng người dùng sang giảng viên.
- Mọi quyết định duyệt, sửa hoặc từ chối phải được ghi vào audit log.

## 10. Hướng thiết kế UI/UX

### Từ khóa

`academic`, `action-first`, `source-grounded`, `calm`, `trustworthy`, `PTIT`.

### Hệ thống thị giác

- Font heading: Manrope.
- Font body/UI: Be Vietnam Pro.
- Màu chính: đỏ PTIT `#B42318`.
- Nền ứng dụng: trắng ngà hoặc xám ấm rất nhạt.
- Icon: Lucide, nét đồng nhất.
- Border và shadow nhẹ; không dùng glassmorphism hoặc gradient AI tím hồng.
- Kích thước vùng tương tác chính tối thiểu 44 × 44 px.

Chi tiết token và component nằm tại
[design-system/ptit-teaching-assistant/MASTER.md](./design-system/ptit-teaching-assistant/MASTER.md).

### Motion

- Entrance motion ngắn cho hero và khối nội dung chính.
- Hover chỉ dùng cho phần tử có thể tương tác.
- Chuyển route hoặc thay trạng thái trong khoảng 150–220 ms.
- Tôn trọng `prefers-reduced-motion`.
- Không tự động chạy animation dài ở dashboard gây mất tập trung.

## 11. Chiến lược kỹ thuật

### Kiến trúc hiện tại

| Lớp      | Lựa chọn                                      | Lý do                                                      |
| -------- | --------------------------------------------- | ---------------------------------------------------------- |
| Frontend | React, React Router, Vite                     | Phù hợp SPA, chia route và phát triển UI nhanh             |
| Backend  | Node.js HTTP API                              | Gọn cho MVP và kiểm soát rõ contract                       |
| Database | SQLite                                        | Không cần dịch vụ riêng, phù hợp demo và phát triển cục bộ |
| Auth     | Session cookie HttpOnly và RBAC               | Vai trò được quyết định từ tài khoản, bảo vệ ở server      |
| UI       | CSS custom properties và component dùng chung | Giữ design system nhất quán                                |
| Test     | Vitest, Testing Library và jsdom              | Kiểm thử logic, repository và hồi quy UI                   |

### Nguyên tắc kiến trúc

- Page component không import trực tiếp dữ liệu mock.
- UI gọi repository facade; API và mock adapter cùng tuân theo một contract.
- RAG nằm sau adapter riêng để có thể thay endpoint mà không viết lại trang.
- Phân quyền phải kiểm tra ở backend, không chỉ ẩn nút trên giao diện.
- Route được lazy-load; mọi màn dữ liệu có loading, empty và error state.
- Dữ liệu người dùng nhập phải có giới hạn, validation và cách hiển thị chống tràn.

## 12. Kế hoạch phát triển ở mức ý tưởng

### Chặng A — Nền tảng MVP

**Trạng thái:** Đã hoàn thành.

- Routing, layout, xác thực theo tài khoản và phân quyền.
- Backend cục bộ, SQLite và repository layer.
- Luồng quản lý lớp và luồng học, tra cứu, hỏi đáp cơ bản.

### Chặng B — Đồng bộ trải nghiệm sản phẩm

**Trạng thái:** Đang review UI/UX.

- Đồng bộ trang chủ, đăng nhập, dashboard và các trang bên trong.
- Chuyển dashboard sinh viên sang hướng Action-first.
- Làm rõ nội dung, hierarchy, trạng thái và responsive.
- Loại bỏ dữ liệu hoặc thành phần demo gây hiểu nhầm trước bản review chính thức.

### Chặng C — Kết nối RAG

**Trạng thái:** Thực hiện sau khi UI/UX và contract được chốt.

- Gắn RAG adapter thật.
- Ánh xạ citation với tài liệu và phiên bản trong hệ thống.
- Thêm timeout, retry, hủy yêu cầu và trạng thái dịch vụ.
- Đánh giá chất lượng truy xuất và câu trả lời bằng tập câu hỏi kiểm thử.
- Chạy thử quy trình giảng viên kiểm duyệt trước khi mở rộng.

### Chặng D — Hardening và phát hành thử

- E2E test cho hai vòng lặp cốt lõi.
- Accessibility theo WCAG 2.2 AA.
- Kiểm thử bảo mật session, RBAC, CSRF, input và rate limit.
- Kiểm tra quyền sử dụng học liệu, hình ảnh và chính sách dữ liệu.
- Thiết lập production, logging, backup và rollback.

## 13. Trạng thái chức năng hiện tại

| Nhóm                   | Trạng thái          | Ghi chú                                                                  |
| ---------------------- | ------------------- | ------------------------------------------------------------------------ |
| Trang chủ và đăng nhập | Đã hoạt động        | Tài khoản tự quyết định vai trò và route sau đăng nhập                   |
| Dashboard sinh viên    | Đã hoạt động        | Action-first, học phần, tiến độ, phản hồi và hoạt động gần đây           |
| Học phần và bài học    | Đã hoạt động        | Có tiến độ, chương, bài, tra cứu và hỏi đáp theo phạm vi                 |
| Hỏi đáp sinh viên      | Đã hoạt động        | Có lịch sử, trạng thái, phản hồi giảng viên và chỉ hiển thị RAG đã duyệt |
| Quản lý lớp giảng viên | Đã hoạt động        | Lớp, sinh viên, bài học, học liệu, câu hỏi và thống kê cơ bản            |
| RAG review             | Demo có persistence | Fixture, citation và quyết định kiểm duyệt được lưu; chưa gọi model thật |
| AI trợ giảng           | Chỉ demo UI/UX      | Hội thoại, gợi ý và nguồn mô phỏng                                       |
| Thông báo              | Placeholder         | Chưa có cơ chế thông báo thật hoặc realtime                              |
| RAG adapter thật       | Chưa tích hợp       | Thực hiện sau khi contract, corpus và tiêu chí đánh giá được duyệt       |
| Production operations  | Chưa hoàn chỉnh     | Còn monitoring, backup, E2E, accessibility audit và quy trình rollback   |
| SSO PTIT               | Ngoài MVP hiện tại  | Chỉ triển khai khi có quyền truy cập và yêu cầu tích hợp chính thức      |

## 14. Chính sách nguồn tri thức

Corpus mặc định của RAG không lấy từ Internet mở. Nguồn mục tiêu gồm:

- Giáo trình được dùng chính thức cho từng học phần.
- Văn kiện Đảng, văn bản pháp luật và tài liệu gốc có phiên bản xác định.
- Bài giảng, đề cương và học liệu đã được PTIT hoặc đơn vị chuyên môn phê duyệt.
- Câu trả lời trực tiếp của giảng viên, được lưu tách biệt với nội dung AI.

Mỗi tài liệu cần có tối thiểu: chủ sở hữu, học phần, phiên bản, ngày hiệu lực, trạng thái phê
duyệt, quyền truy cập và thông tin nguồn. Việc ingest hoặc index chỉ diễn ra với phiên bản
được phép sử dụng. Không gửi dữ liệu cá nhân không cần thiết của sinh viên sang dịch vụ RAG.

## 15. Checkpoint cần review

| Checkpoint | Nội dung cần chốt                                                     |
| ---------- | --------------------------------------------------------------------- |
| A          | Trang chủ và đăng nhập có phản ánh đúng tên, mục đích sản phẩm không? |
| B          | Luồng sinh viên có giúp tìm “việc cần làm tiếp theo” đủ nhanh không?  |
| C          | Dashboard giảng viên có ưu tiên đúng công việc cần xử lý không?       |
| D          | Ngôn ngữ trạng thái AI, nguồn và kiểm duyệt có gây hiểu nhầm không?   |
| E          | Contract RAG, bộ tài liệu nguồn và tiêu chí đánh giá đã đủ rõ chưa?   |
| F          | Điều kiện bảo mật, accessibility và vận hành đã đủ để public chưa?    |

## 16. Tiêu chí đánh giá thành công

### Sản phẩm

- Sinh viên mở được bài đang học hoặc khu vực hỏi đáp trong tối đa hai thao tác từ dashboard.
- Người dùng luôn biết câu trả lời đến từ AI, giảng viên hay nguồn nào.
- Giảng viên nhận biết được các câu hỏi đang chờ ngay khi vào dashboard.
- Không có luồng yêu cầu người dùng chọn vai trò thủ công sau đăng nhập.

### Trải nghiệm

- Không có horizontal scroll ở 375, 768, 1024 và 1440 px.
- Các thao tác chính sử dụng được bằng bàn phím.
- Mỗi trang dữ liệu có loading, empty và error state.
- Nội dung dài hoặc dữ liệu bất thường không làm vỡ layout.
- Motion không cản trở người dùng đã bật reduced motion.

### RAG sau tích hợp

- Mọi câu trả lời công bố có ít nhất một nguồn hợp lệ hoặc được đánh dấu là phản hồi trực
  tiếp của giảng viên.
- Citation mở đúng tài liệu, phiên bản và vị trí.
- Lưu được model version, index version, trace ID và thời điểm sinh.
- Có tập câu hỏi đánh giá riêng cho từng học phần.
- Có cơ chế chuyển cho giảng viên khi nguồn yếu, mâu thuẫn hoặc không tìm thấy.

## 17. Rủi ro và cách giảm thiểu

| Rủi ro                                         | Cách giảm thiểu                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| AI trả lời trôi khỏi giáo trình                | Bắt buộc truyền ngữ cảnh học phần, truy xuất nguồn giới hạn và hiển thị citation |
| Nguồn cũ hoặc sai phiên bản                    | Quản lý `MaterialVersion` và lưu `indexVersion`                                  |
| Người dùng hiểu nhầm nội dung AI đã được duyệt | Nhãn trạng thái rõ, chỉ server được đổi trạng thái kiểm duyệt                    |
| Giảng viên bị quá tải bởi hàng đợi             | Ưu tiên theo lớp, môn, thời gian và mức độ thiếu bằng chứng                      |
| Dữ liệu đầu vào bất thường làm vỡ UI           | Validation, giới hạn độ dài, preview an toàn và test hồi quy                     |
| Lộ dữ liệu hoặc truy cập sai vai trò           | HttpOnly session, RBAC ở endpoint, CSRF protection và audit log                  |
| Sao chép phong cách tham khảo quá sát          | Chỉ lấy nguyên tắc và pattern; giữ nhận diện, nội dung và component riêng        |
| Hình ảnh hoặc học liệu chưa rõ quyền sử dụng   | Lưu nguồn, giấy phép, phiên bản và review trước phát hành                        |

## 18. Nguồn tham khảo sản phẩm và trải nghiệm

| Nguồn                                                                                                                    | Điều học hỏi và áp dụng                                                                             | Không sao chép                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Trang chủ PTIT](https://ptit.edu.vn/)                                                                                   | Nhận diện tổ chức, màu đỏ thương hiệu, giọng văn chính thống và cách giới thiệu vai trò giáo dục số | Không bê nguyên layout, nội dung hoặc tài sản chưa xác minh quyền sử dụng     |
| [PTIT Chính trị hiện có](https://chinhtri.ptitai.org/)                                                                   | Tên học phần, bối cảnh nội dung và cách diễn đạt gần với sinh viên PTIT                             | Không sao chép từng pixel; sản phẩm mới có kiến trúc và luồng riêng           |
| [Khanmigo](https://www.khanmigo.ai/)                                                                                     | AI là trợ giảng hỗ trợ tư duy, đặt trong hệ sinh thái học tập thay vì một chatbot trả lời mọi thứ   | Không dùng thương hiệu, minh họa, copywriting hoặc giao diện độc quyền        |
| [Khan Academy Learning Dashboard](https://blog.khanacademy.org/introducing-the-learning-dashboard/)                      | Dashboard ưu tiên hành động tiếp theo, tiến độ và gợi ý học tập                                     | Không đưa gamification vào MVP nếu không phục vụ mục tiêu học                 |
| [Khan Academy Mastery](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery-) | Tiến độ cần gắn với cấp học phần, đơn vị nội dung và mục tiêu rõ                                    | Không đồng nhất phần trăm hoàn thành với mức độ hiểu sâu khi chưa có đánh giá |
| [Canvas LMS](https://www.instructure.com/canvas)                                                                         | Tổ chức lớp, nội dung, công việc, phản hồi và báo cáo theo vai trò                                  | Không mở rộng thành LMS đầy đủ trong MVP                                      |
| [NotebookLM](https://support.google.com/notebooklm/answer/16164461)                                                      | Hỏi đáp dựa trên tập nguồn đã chọn, citation trực tiếp và khả năng kiểm tra lại                     | Không xem citation tự động là bằng chứng nội dung chắc chắn đúng              |

## 19. Nguồn tham khảo AI, accessibility và kỹ thuật

- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401):
  cơ sở cho việc kết hợp mô hình sinh với bộ nhớ ngoài và theo dõi nguồn.
- [UNESCO — Guidance for generative AI in education and research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research):
  định hướng lấy con người làm trung tâm, bảo vệ dữ liệu và thiết kế sư phạm có kiểm soát.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework):
  quản trị rủi ro, tài liệu hóa, đánh giá và giám sát trong vòng đời hệ thống AI.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): tiêu chuẩn cho tương phản, điều hướng bàn phím,
  focus, reflow, target size và accessible authentication.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html):
  nguyên tắc xác thực và xử lý lỗi đăng nhập.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html):
  session ID, cookie và vòng đời phiên đăng nhập.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html):
  bảo vệ các request thay đổi dữ liệu.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  validation theo cú pháp, ngữ nghĩa và giới hạn độ dài.
- [React `lazy`](https://react.dev/reference/react/lazy): chia code theo route và chỉ tải
  component khi cần.
- [SQLite Features](https://sqlite.org/features.html): cơ sở lựa chọn SQLite cho bản MVP
  cục bộ và demo ít cấu hình.

## 20. Tài liệu nội bộ liên quan

- [Kế hoạch triển khai](./PROJECT_PLAN.md)
- [README và hướng dẫn chạy](./README.md)
- [API contract](./docs/API.md)
- [Database](./docs/DATABASE.md)
- [Frontend contracts](./docs/FRONTEND_CONTRACTS.md)
- [Design system](./design-system/ptit-teaching-assistant/MASTER.md)
- [Nguồn ảnh trình chiếu học phần](./src/assets/COURSE_SHOWCASE_ATTRIBUTION.md)
- [Nguồn ảnh bìa học phần](./src/assets/courses/ATTRIBUTION.md)
- [Nguồn ảnh dashboard](./src/assets/dashboard/ATTRIBUTION.md)

## 21. Quy ước cập nhật tài liệu

Cập nhật `IDEA.md` khi có thay đổi về định vị, người dùng, nguyên tắc sản phẩm, vai trò của
AI hoặc nguồn tham khảo. Cập nhật `PROJECT_PLAN.md` khi thay đổi phase, phạm vi công việc,
deadline hoặc tiêu chí hoàn thành. Các quyết định đã review nên ghi ngày và lý do để tránh
lặp lại tranh luận cũ.
