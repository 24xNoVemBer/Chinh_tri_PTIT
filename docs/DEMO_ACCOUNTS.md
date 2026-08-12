# Tài khoản và dữ liệu demo

> Chỉ sử dụng trong development hoặc môi trường review cô lập. Không dùng các mật khẩu này ở
> staging/production và không nạp seed vào cơ sở dữ liệu thật.

## Cách nạp

```bash
npm run db:seed:demo -- --confirm-demo-seed
```

Lệnh hỗ trợ SQLite và PostgreSQL. Với PostgreSQL vẫn phải cung cấp ba biến xác nhận
`DATABASE_CONFIRM_HOST`, `DATABASE_CONFIRM_NAME`, `DATABASE_CONFIRM_USER`. Lệnh luôn bị từ chối
khi `NODE_ENV=production`.

Seed có ID cố định và dùng upsert, vì vậy có thể chạy lại mà không nhân bản dữ liệu.

## Quản trị viên

Mật khẩu chung: `Admin@123`

| ID       | Email                      |
| -------- | -------------------------- |
| `admin1` | `admin.demo01@ptit.edu.vn` |
| `admin2` | `admin.demo02@ptit.edu.vn` |

## Giảng viên

Mật khẩu chung: `Lecturer@123`

| ID    | Email                         |
| ----- | ----------------------------- |
| `l1`  | `ductu@ptit.edu.vn`           |
| `l2`  | `nva@ptit.edu.vn`             |
| `l3`  | `lecturer.demo03@ptit.edu.vn` |
| `l4`  | `lecturer.demo04@ptit.edu.vn` |
| `l5`  | `lecturer.demo05@ptit.edu.vn` |
| `l6`  | `lecturer.demo06@ptit.edu.vn` |
| `l7`  | `lecturer.demo07@ptit.edu.vn` |
| `l8`  | `lecturer.demo08@ptit.edu.vn` |
| `l9`  | `lecturer.demo09@ptit.edu.vn` |
| `l10` | `lecturer.demo10@ptit.edu.vn` |

## Sinh viên

Mật khẩu chung: `Student@123`

| ID    | Email                        |
| ----- | ---------------------------- |
| `s1`  | `tuananh@ptit.edu.vn`        |
| `s2`  | `mai.tt@ptit.edu.vn`         |
| `s3`  | `hoang.lv@ptit.edu.vn`       |
| `s4`  | `trang.pt@ptit.edu.vn`       |
| `s5`  | `tuan.hm@ptit.edu.vn`        |
| `s6`  | `student.demo06@ptit.edu.vn` |
| `s7`  | `student.demo07@ptit.edu.vn` |
| `s8`  | `student.demo08@ptit.edu.vn` |
| `s9`  | `student.demo09@ptit.edu.vn` |
| `s10` | `student.demo10@ptit.edu.vn` |
| `s11` | `student.demo11@ptit.edu.vn` |
| `s12` | `student.demo12@ptit.edu.vn` |
| `s13` | `student.demo13@ptit.edu.vn` |
| `s14` | `student.demo14@ptit.edu.vn` |
| `s15` | `student.demo15@ptit.edu.vn` |
| `s16` | `student.demo16@ptit.edu.vn` |
| `s17` | `student.demo17@ptit.edu.vn` |
| `s18` | `student.demo18@ptit.edu.vn` |
| `s19` | `student.demo19@ptit.edu.vn` |
| `s20` | `student.demo20@ptit.edu.vn` |
| `s21` | `student.demo21@ptit.edu.vn` |
| `s22` | `student.demo22@ptit.edu.vn` |
| `s23` | `student.demo23@ptit.edu.vn` |
| `s24` | `student.demo24@ptit.edu.vn` |
| `s25` | `student.demo25@ptit.edu.vn` |
| `s26` | `student.demo26@ptit.edu.vn` |
| `s27` | `student.demo27@ptit.edu.vn` |
| `s28` | `student.demo28@ptit.edu.vn` |
| `s29` | `student.demo29@ptit.edu.vn` |
| `s30` | `student.demo30@ptit.edu.vn` |
| `s31` | `student.demo31@ptit.edu.vn` |
| `s32` | `student.demo32@ptit.edu.vn` |
| `s33` | `student.demo33@ptit.edu.vn` |
| `s34` | `student.demo34@ptit.edu.vn` |
| `s35` | `student.demo35@ptit.edu.vn` |
| `s36` | `student.demo36@ptit.edu.vn` |
| `s37` | `student.demo37@ptit.edu.vn` |
| `s38` | `student.demo38@ptit.edu.vn` |
| `s39` | `student.demo39@ptit.edu.vn` |
| `s40` | `student.demo40@ptit.edu.vn` |

## Quy mô dữ liệu

| Nhóm dữ liệu             | Số lượng |
| ------------------------ | -------: |
| Tài khoản                |       52 |
| Lớp tín chỉ demo         |       10 |
| Phân công giảng viên     |       20 |
| Enrollment               |      200 |
| Câu hỏi trắc nghiệm demo |       45 |
| Phiên luyện tập/thi thử  |      200 |
| Lượt câu hỏi trong phiên |      600 |
| Câu hỏi hỏi đáp          |       80 |

Mỗi lớp có một giảng viên phụ trách chính và một giảng viên phối hợp. Sinh viên được chia giữa hai
tổ của từng môn; dữ liệu phiên và hỏi đáp được gắn trực tiếp vào lớp để kiểm tra thống kê không cộng
lẫn giữa các tổ.
