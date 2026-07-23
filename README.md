# Trợ giảng Chính trị PTIT

Nền tảng hỗ trợ giảng viên quản lý lớp học và hỗ trợ sinh viên tra cứu, hỏi đáp theo môn học.

## Trạng thái

Giai đoạn 5 đã hoàn thành ở mức demo UI/UX cục bộ:

- Frontend React/Vite cho hai vai trò, responsive và lazy-load theo route.
- Backend Node.js với API JSON, SQLite persistence, session cookie HttpOnly và RBAC.
- Giảng viên quản lý lớp, sinh viên, lịch bài học, học liệu và trả lời câu hỏi.
- Sinh viên theo dõi tiến độ, tra cứu nội dung, đặt câu hỏi và xem lịch sử.
- Audit log truy vết các thao tác quản lý và hỏi đáp quan trọng.

Luồng RAG hiện dùng fixture có nhãn demo để review giao diện, citation và kiểm duyệt xuyên suốt hai
vai trò. **Model/endpoint RAG thật chưa được tích hợp** và sẽ được nối sau khi UI/UX được duyệt.

## Yêu cầu

- Node.js 24+
- npm 11+

## Chạy development

```bash
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api`
- SQLite mặc định: `data/ptit-teaching-assistant.sqlite`

Có thể sao chép `.env.example` thành `.env` để đổi `PORT`, `DATABASE_PATH` hoặc `NODE_ENV`.

## Tài khoản review cục bộ

| Vai trò    | Email                 | Mật khẩu       |
| ---------- | --------------------- | -------------- |
| Sinh viên  | `tuananh@ptit.edu.vn` | `Student@123`  |
| Giảng viên | `ductu@ptit.edu.vn`   | `Lecturer@123` |

Tài khoản seed chỉ dùng cho development; không sử dụng trong production.

## Build và chạy production cục bộ

```bash
npm run build
npm start
```

Backend sẽ phục vụ cả API và thư mục `dist` tại `http://127.0.0.1:3001`.

## Kiểm tra chất lượng

```bash
npm run format:check
npm run lint
npm run test
npm run build
npm run check
```

Bộ test hiện có 25 test, bao gồm session, RBAC, hai vertical slice, audit log và mở lại file
SQLite để kiểm tra persistence.

## Tài liệu

- [Kế hoạch dự án](./PROJECT_PLAN.md)
- [API Phase 4](./docs/API.md)
- [SQLite schema](./docs/DATABASE.md)
- [Frontend contracts](./docs/FRONTEND_CONTRACTS.md)
- [Design system](./design-system/ptit-teaching-assistant/MASTER.md)

## Cấu trúc chính

- `server`: HTTP API, session, SQLite schema/seed và repository backend.
- `src`: router, auth provider, layout, page và component frontend.
- `src/services/api`: API client và API repository.
- `src/services/repositories`: mock repository giữ lại cho unit test và phát triển contract.
- `design-system`: source of truth cho UI.
- `docs`: contract và quyết định kỹ thuật.
