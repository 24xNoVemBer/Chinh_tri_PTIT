# Hợp đồng dữ liệu và thống kê: Luyện tập trắc nghiệm

## 1. Nguyên tắc

- Dữ liệu raw ở `practice_sessions` và `practice_session_questions` là nguồn sự thật.
- Mọi thống kê phải có cỡ mẫu (`sampleSize`) khi trả về phần trăm.
- Thống kê giảng viên luôn giới hạn theo lớp mà giảng viên phụ trách.
- Không gọi kết quả là “Mastery” trước khi có chuẩn hóa độ khó và đủ dữ liệu.
- Các phiên chưa hoàn thành không được tính vào tỷ lệ hoàn thành.

## 2. Thuật ngữ

| Thuật ngữ            | Ý nghĩa                                                  |
| -------------------- | -------------------------------------------------------- |
| `standard`           | Phiên luyện tập ngẫu nhiên theo học phần/chương.         |
| `retry_wrong`        | Phiên chỉ lấy các câu đã trả lời sai từ một phiên nguồn. |
| `accuracy`           | Tỷ lệ câu đúng trên tổng câu đã trả lời.                 |
| `completionRate`     | Tỷ lệ phiên đã hoàn thành trên tổng phiên.               |
| `weakTopic`          | Chương có ít nhất 5 lượt trả lời và accuracy dưới 60%.   |
| `observedDifficulty` | `1 - accuracy`, chỉ có ý nghĩa khi đủ lượt làm.          |

## 3. Công thức

```text
accuracy = correctAnswers / answeredAnswers * 100
completionRate = completedSessions / totalSessions * 100
averageSessionSeconds = sum(completedAt - startedAt) / completedSessions
observedDifficulty = 100 - accuracy
```

Quy tắc làm tròn: phần trăm hiển thị là số nguyên; API có thể trả thêm giá trị thập phân nếu cần vẽ biểu đồ.

Quy tắc mẫu nhỏ:

- Dưới 5 lượt: hiển thị “Chưa đủ dữ liệu”.
- Từ 5 lượt: được hiển thị accuracy theo chương/câu.
- Biểu đồ xu hướng cần tối thiểu 4 mốc thời gian.

## 4. Payload sinh viên

### `GET /api/student/practice/overview`

```json
{
  "continueSession": {
    "id": "practice_session_123",
    "subjectName": "Triết học Mác – Lênin",
    "answeredCount": 3,
    "questionCount": 10,
    "updatedAt": "2026-08-12T09:00:00.000Z"
  },
  "summary": {
    "answeredCount": 42,
    "correctCount": 31,
    "accuracy": 74,
    "sampleSize": 42,
    "completedSessions": 5
  },
  "subjects": [],
  "weakTopics": [],
  "recentSessions": []
}
```

### `GET /api/student/practice/stats`

Query đề xuất:

- `subjectId` tùy chọn.
- `chapterId` tùy chọn.
- `range=7d|30d|all`, mặc định `30d`.

Response phải trả `accuracy`, `sampleSize`, `completedSessions`, `averageSessionSeconds` và danh sách theo chương.

### Mở rộng tạo phiên

```json
{
  "subjectId": "sub1",
  "classId": "class1",
  "chapterId": "chap1",
  "questionCount": 5,
  "mode": "standard",
  "sourceSessionId": null
}
```

Với `retry_wrong`, `sourceSessionId` là bắt buộc và backend tự lấy các câu sai từ phiên nguồn.

## 5. Payload giảng viên

### `GET /api/lecturer/practice-analytics`

Query đề xuất:

- `classId` bắt buộc nếu giảng viên dạy nhiều lớp.
- `subjectId` tùy chọn.
- `chapterId` tùy chọn.
- `range=7d|30d|all`, mặc định `30d`.

```json
{
  "scope": {
    "classId": "class1",
    "subjectId": "sub1",
    "range": "30d"
  },
  "summary": {
    "studentCount": 48,
    "activeStudentCount": 36,
    "attemptCount": 126,
    "completedSessionCount": 94,
    "completionRate": 75,
    "accuracy": 68,
    "sampleSize": 126
  },
  "byChapter": [],
  "trend": [],
  "mostMissedQuestions": [],
  "questionStats": []
}
```

Mỗi item trong `byChapter`, `trend`, `mostMissedQuestions` phải có `sampleSize` và không chỉ dựa vào màu để biểu đạt trạng thái.

## 6. Database contract dự kiến

Migration tiếp theo cần bổ sung:

- `practice_sessions.class_id` tham chiếu lớp ghi danh.
- `practice_sessions.mode` với `standard|retry_wrong`.
- `practice_sessions.source_session_id` nullable, tham chiếu phiên nguồn.
- `practice_session_questions.started_at` nullable.
- `practice_session_questions.answer_duration_ms` nullable.

Index tối thiểu:

- `practice_sessions(student_id, subject_id, updated_at)`.
- `practice_sessions(class_id, status, updated_at)`.
- `practice_session_questions(question_id, is_correct)`.
- `practice_questions(subject_id, chapter_id, status)`.

## 7. Quyền truy cập

### Sinh viên

- Chỉ đọc phiên của chính mình.
- Chỉ tạo phiên trên học phần/lớp đang ghi danh.
- Không nhận `correctOptionId` hoặc `explanation` trước khi trả lời.

### Giảng viên

- Chỉ đọc analytics của lớp mình phụ trách.
- Chỉ quản lý câu hỏi thuộc học phần mình đang dạy.
- Không xem dữ liệu sinh viên ngoài scope lớp/học phần.

## 8. Hiệu năng và cache

- Danh sách câu hỏi giảng viên phải phân trang ở backend.
- Overview sinh viên có thể cache ngắn 15–30 giây.
- Analytics giảng viên dùng query aggregate có index; khi dữ liệu lớn chuyển sang bảng rollup theo ngày.
- Tránh `ORDER BY RANDOM()` trên toàn bảng câu hỏi ở production; dùng chiến lược lấy mẫu có index.
- Mục tiêu ban đầu: p95 các endpoint overview/analytics dưới 500ms trên dữ liệu staging đại diện.

## 9. Kiểm thử contract

- Sinh viên không thể đọc đáp án trước khi trả lời.
- Sinh viên không tạo được phiên ngoài lớp ghi danh.
- `retry_wrong` chỉ chứa câu sai của phiên nguồn.
- Giảng viên A không đọc được analytics của lớp giảng viên B.
- Accuracy, completion rate và sample size khớp dữ liệu raw.
- Phiên đang làm không được tính là completed.
