# PTIT Teaching Assistant — Design System

> Source of truth cho giao diện quản lý lớp và tra cứu–hỏi đáp. Page override trong `pages/` được ưu tiên hơn tài liệu này.

## Định hướng

- Phong cách: học thuật hiện đại, rõ ràng, đáng tin cậy, không trang trí dư thừa.
- Mật độ: vừa–cao cho dashboard; thoáng hơn ở màn đọc và hỏi đáp.
- Chuyển động: tối thiểu, 150–220 ms; luôn hỗ trợ `prefers-reduced-motion`.
- Hệ icon: Lucide; không dùng emoji làm icon chức năng.

## Màu sắc

| Vai trò        | Token                      | Giá trị   |
| -------------- | -------------------------- | --------- |
| Primary PTIT   | `--color-primary`          | `#B42318` |
| Primary hover  | `--color-primary-hover`    | `#8E1B13` |
| Primary tint   | `--color-primary-soft`     | `#FFF1EF` |
| Nền ứng dụng   | `--color-background`       | `#F5F3F0` |
| Surface        | `--color-surface`          | `#FFFFFF` |
| Nội dung chính | `--color-foreground`       | `#201D1A` |
| Nội dung phụ   | `--color-muted-foreground` | `#625B56` |
| Border         | `--color-border`           | `#DED8D2` |
| Thành công     | `--color-success`          | `#217A4B` |
| Cảnh báo       | `--color-warning`          | `#9A6700` |

Không dùng primary làm nền diện tích lớn. Đỏ PTIT dùng cho hành động chính, trạng thái active và điểm nhấn điều hướng.

## Typography

- Heading: `Be Vietnam Pro` với weight 600–700, fallback system sans-serif.
- Body/UI: `Be Vietnam Pro`, fallback system sans-serif.
- Body tối thiểu 16 px; helper text tối thiểu 12 px.
- Màn đọc dùng line-height khoảng 1.8 và chiều rộng tối đa 46rem.

## Layout

- Content tối đa 72–78rem.
- Sidebar giảng viên 15rem ở desktop; chuyển thành thanh ngang ở dưới 56rem.
- Breakpoint kiểm tra bắt buộc: 375, 768, 1024 và 1440 px.
- Không cho phép horizontal scroll toàn trang.
- Mọi vùng click/chạm chính tối thiểu 44×44 px.

## Component rules

### Buttons

- Primary: nền đỏ PTIT, chữ trắng.
- Secondary: nền trắng, border rõ; hover chuyển sang tint đỏ.
- Luôn có label; icon-only phải có `aria-label` và `title` khi cần.
- Disabled phải khác biệt bằng opacity và trạng thái con trỏ.

### Cards

- Surface trắng, border trung tính, shadow nhẹ.
- Card điều hướng có hover border/shadow; transform tối đa 2–3 px.
- Card thông tin tĩnh không có cursor pointer hoặc hiệu ứng giả tương tác.

### Forms

- Label luôn hiển thị; placeholder không thay thế label.
- Lỗi đặt cạnh field, nối bằng `aria-describedby` và `aria-invalid`.
- Search chỉ chạy khi submit hoặc đã debounce.

### States

Mọi trang dữ liệu phải có loading, empty và error state. Các thao tác ghi dữ liệu cần success/error feedback rõ ràng.

## Accessibility checklist

- Độ tương phản nội dung chính tối thiểu 4.5:1.
- Focus ring 3 px và không bị cắt.
- Keyboard navigation đầy đủ.
- Không dùng màu làm tín hiệu trạng thái duy nhất.
- Table có `th` và `scope` phù hợp.
- `prefers-reduced-motion` tắt chuyển động không thiết yếu.

## Anti-patterns

- Link chết hoặc nhiều menu cùng active.
- Sidebar chứa mục chưa có route chỉ để “đủ tính năng”.
- Nền xám đậm làm giảm khả năng đọc nội dung.
- Card đồng dạng cho mọi loại thông tin.
- Gradient AI tím/hồng, glassmorphism hoặc animation trang trí không phục vụ nghiệp vụ.
- Nội dung RAG không phân biệt với nguồn hoặc câu trả lời của giảng viên.
