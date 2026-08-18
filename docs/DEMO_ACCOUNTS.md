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

| ID       | Họ tên                | Email                      | Vai trò | Mật khẩu    |
| -------- | --------------------- | -------------------------- | ------- | ----------- |
| `admin1` | Quản trị viên Demo 01 | `admin.demo01@ptit.edu.vn` | Admin   | `Admin@123` |
| `admin2` | Quản trị viên Demo 02 | `admin.demo02@ptit.edu.vn` | Admin   | `Admin@123` |

## Giảng viên

| ID    | Họ tên             | Email                         | Vai trò    | Mật khẩu       |
| ----- | ------------------ | ----------------------------- | ---------- | -------------- |
| `l1`  | TS. Đào Đức Tú     | `ductu@ptit.edu.vn`           | Giảng viên | `Lecturer@123` |
| `l2`  | ThS. Nguyễn Văn A  | `nva@ptit.edu.vn`             | Giảng viên | `Lecturer@123` |
| `l3`  | Giảng viên Demo 03 | `lecturer.demo03@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l4`  | Giảng viên Demo 04 | `lecturer.demo04@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l5`  | Giảng viên Demo 05 | `lecturer.demo05@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l6`  | Giảng viên Demo 06 | `lecturer.demo06@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l7`  | Giảng viên Demo 07 | `lecturer.demo07@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l8`  | Giảng viên Demo 08 | `lecturer.demo08@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l9`  | Giảng viên Demo 09 | `lecturer.demo09@ptit.edu.vn` | Giảng viên | `Lecturer@123` |
| `l10` | Giảng viên Demo 10 | `lecturer.demo10@ptit.edu.vn` | Giảng viên | `Lecturer@123` |

## Sinh viên

| ID    | Họ tên              | Email                        | Vai trò   | Mật khẩu      |
| ----- | ------------------- | ---------------------------- | --------- | ------------- |
| `s1`  | Nguyễn Văn Tuấn Anh | `tuananh@ptit.edu.vn`        | Sinh viên | `Student@123` |
| `s2`  | Trần Thị Mai        | `mai.tt@ptit.edu.vn`         | Sinh viên | `Student@123` |
| `s3`  | Lê Văn Hoàng        | `hoang.lv@ptit.edu.vn`       | Sinh viên | `Student@123` |
| `s4`  | Phạm Thu Trang      | `trang.pt@ptit.edu.vn`       | Sinh viên | `Student@123` |
| `s5`  | Hoàng Minh Tuấn     | `tuan.hm@ptit.edu.vn`        | Sinh viên | `Student@123` |
| `s6`  | Sinh viên Demo 06   | `student.demo06@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s7`  | Sinh viên Demo 07   | `student.demo07@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s8`  | Sinh viên Demo 08   | `student.demo08@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s9`  | Sinh viên Demo 09   | `student.demo09@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s10` | Sinh viên Demo 10   | `student.demo10@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s11` | Sinh viên Demo 11   | `student.demo11@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s12` | Sinh viên Demo 12   | `student.demo12@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s13` | Sinh viên Demo 13   | `student.demo13@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s14` | Sinh viên Demo 14   | `student.demo14@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s15` | Sinh viên Demo 15   | `student.demo15@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s16` | Sinh viên Demo 16   | `student.demo16@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s17` | Sinh viên Demo 17   | `student.demo17@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s18` | Sinh viên Demo 18   | `student.demo18@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s19` | Sinh viên Demo 19   | `student.demo19@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s20` | Sinh viên Demo 20   | `student.demo20@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s21` | Sinh viên Demo 21   | `student.demo21@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s22` | Sinh viên Demo 22   | `student.demo22@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s23` | Sinh viên Demo 23   | `student.demo23@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s24` | Sinh viên Demo 24   | `student.demo24@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s25` | Sinh viên Demo 25   | `student.demo25@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s26` | Sinh viên Demo 26   | `student.demo26@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s27` | Sinh viên Demo 27   | `student.demo27@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s28` | Sinh viên Demo 28   | `student.demo28@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s29` | Sinh viên Demo 29   | `student.demo29@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s30` | Sinh viên Demo 30   | `student.demo30@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s31` | Sinh viên Demo 31   | `student.demo31@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s32` | Sinh viên Demo 32   | `student.demo32@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s33` | Sinh viên Demo 33   | `student.demo33@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s34` | Sinh viên Demo 34   | `student.demo34@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s35` | Sinh viên Demo 35   | `student.demo35@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s36` | Sinh viên Demo 36   | `student.demo36@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s37` | Sinh viên Demo 37   | `student.demo37@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s38` | Sinh viên Demo 38   | `student.demo38@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s39` | Sinh viên Demo 39   | `student.demo39@ptit.edu.vn` | Sinh viên | `Student@123` |
| `s40` | Sinh viên Demo 40   | `student.demo40@ptit.edu.vn` | Sinh viên | `Student@123` |

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
