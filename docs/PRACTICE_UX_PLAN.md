# Kế hoạch UX: Luyện tập trắc nghiệm

## 1. Mục tiêu

Module luyện tập giúp sinh viên ôn các học phần chính trị theo từng chương, nhận phản hồi ngay sau mỗi lựa chọn và biết bước học tiếp theo. Giảng viên theo dõi được lớp đang yếu ở chương hoặc câu hỏi nào.

Định hướng đã chốt:

- Sinh viên: tập trung và có ngữ cảnh như Khan Academy, cấu hình phiên như Quizlet.
- Giảng viên: quản lý câu hỏi như một question bank, phân tích theo hướng Canvas/Classroom.
- Tên hiển thị: **Mức độ ôn tập**, chưa dùng “Mastery” khi ngân hàng chưa được hiệu chuẩn.
- Chủ đề màu: giữ design system PTIT hiện tại (`Manrope`, `Be Vietnam Pro`, đỏ PTIT, nền sáng, Lucide).
- Chuyển động: chỉ dùng để biểu đạt trạng thái, 120–220ms, tôn trọng `prefers-reduced-motion`.

## 2. Phạm vi

### Có trong kế hoạch

- Tạo phiên luyện tập theo học phần, chương và số câu.
- Tiếp tục phiên chưa hoàn thành.
- Hiện đúng/sai và giải thích ngay sau mỗi câu.
- Review toàn bộ phiên và tạo phiên luyện lại câu sai.
- Tiến độ theo học phần/chương.
- Thống kê cá nhân của sinh viên.
- Ngân hàng câu hỏi có tìm kiếm, lọc và phân trang.
- Thống kê theo lớp cho giảng viên.
- Phân quyền thống kê theo `class_id`.

### Chưa làm

- Import Excel, Word, PDF hoặc OCR.
- AI tự sinh câu hỏi.
- Thi có giới hạn thời gian hoặc chống gian lận.
- Leaderboard, điểm kinh nghiệm và gamification.
- Câu hỏi nhiều đáp án đúng hoặc tự luận.
- Đồng bộ điểm sang hệ thống đào tạo.

## 3. Kiến trúc thông tin

### Sinh viên

1. `/student/practice`: tổng quan và bắt đầu phiên.
2. `/student/practice/:sessionId`: làm bài và khôi phục phiên.
3. Kết quả hiển thị ngay trong phiên đã hoàn thành, có deep link ổn định.

Các khối ở trang tổng quan:

- **Tiếp tục luyện tập**: phiên `in_progress` gần nhất.
- **Bắt đầu phiên mới**: học phần, chương, số câu.
- **Mức độ ôn tập**: độ chính xác 30 ngày và tiến độ từng học phần.
- **Cần ôn lại**: chương có tối thiểu 5 lượt trả lời và độ chính xác dưới 60%.
- **Phiên gần đây**: tối đa 5 phiên, có điểm và trạng thái.

### Giảng viên

- `/lecturer/practice-questions`: ngân hàng câu hỏi.
- `/lecturer/practice-questions/new`: tạo câu hỏi.
- `/lecturer/practice-questions/:id/edit`: sửa câu hỏi.
- `/lecturer/practice-analytics`: thống kê theo lớp/học phần.

## 4. Luồng làm bài

```text
Chọn phạm vi → Tạo phiên → Câu 1/N → Chọn đáp án
                         ↓
                 Hiện đúng/sai + giải thích
                         ↓
                    Câu tiếp theo
                         ↓
          Hoàn thành → Kết quả → Review / Retry
```

Quy tắc tương tác:

- Chỉ hiển thị một câu đang làm.
- Hiển thị `Câu x/N` và thanh tiến độ.
- Sau khi chọn, khóa bốn lựa chọn để tránh trả lời hai lần.
- Nút “Câu tiếp theo” chỉ xuất hiện sau feedback.
- Có danh sách số câu để xem trạng thái, nhưng không cho nhảy qua câu chưa trả lời ở MVP.
- Reload hoặc mở deep link phải khôi phục đúng phiên.
- Request lỗi phải có retry tại chỗ, không làm mất đáp án đã lưu.

## 5. Wireframe logic

### Trang tổng quan

```text
[Luyện tập]
[Tiếp tục phiên đang học ----------------] [30 ngày: 72%]
[Học phần] [Chương] [Số câu] [Bắt đầu]
[Triết học 72%] [Kinh tế chính trị 61%]
[Cần ôn lại]                         [Phiên gần đây]
```

### Phiên luyện tập

```text
[Quay lại]  Triết học Mác – Lênin       Câu 3/10
[====================------]

[Nội dung câu hỏi]
[A] Phương án A
[B] Phương án B
[C] Phương án C
[D] Phương án D

[Chính xác / Chưa chính xác]
[Giải thích]
[Câu tiếp theo]
```

### Dashboard giảng viên

```text
[Ngân hàng câu hỏi] [Thống kê]
[Lớp] [Học phần] [Chương] [7 ngày / 30 ngày]
[Sinh viên luyện] [Lượt làm] [Hoàn thành] [Độ chính xác]
[Theo chương]                         [Câu sai nhiều]
[Bảng câu hỏi + lượt làm + tỷ lệ đúng]
```

## 6. Quy tắc visual và responsive

- Nền `#F5F3F0`, surface trắng, border trung tính, đỏ PTIT chỉ dùng cho CTA/active.
- Heading dùng `Manrope`; body/UI dùng `Be Vietnam Pro`.
- Trang tổng quan dashboard tối đa 82rem; màn hình làm bài giữ measure khoảng 46–50rem.
- Không dùng glassmorphism, gradient AI tím/hồng hoặc nền đỏ diện rộng.
- Desktop: nội dung câu hỏi ở giữa, navigator ở cạnh phải nếu còn đủ không gian.
- Mobile: một cột, navigator chuyển thành hàng cuộn ngang có kiểm soát.
- Breakpoint bắt buộc: 375, 768, 1024, 1440px.
- Không horizontal scroll toàn trang; nội dung dài phải tự ngắt.
- Vùng tương tác chính tối thiểu 44×44px.

## 7. Accessibility và trạng thái

- Label hiển thị cho mọi field; không dùng placeholder thay label.
- Feedback đúng/sai dùng icon, text và màu; không phụ thuộc màu đơn lẻ.
- `aria-live` cho kết quả sau khi chọn.
- Focus ring giữ nguyên và focus chuyển tới vùng feedback sau khi chấm.
- Có loading, empty, error, success và retry state cho mọi request.
- Animation 120–220ms; tắt animation không cần thiết khi reduced motion.
- Nội dung câu hỏi và giải thích có thể xuống dòng ở mọi kích thước.

## 8. Tiêu chí nghiệm thu UX

- Sinh viên bắt đầu phiên mới trong tối đa 3 thao tác sau khi chọn học phần.
- Sau khi chọn đáp án, feedback hiển thị mà không reload trang.
- Reload không làm mất tiến độ phiên.
- Có thể tạo phiên chỉ từ các câu sai.
- Giảng viên lọc được câu hỏi và thống kê theo lớp mình phụ trách.
- Các màn hình không tạo horizontal overflow tại 375px.
- Keyboard-only có thể hoàn thành một phiên luyện tập.
