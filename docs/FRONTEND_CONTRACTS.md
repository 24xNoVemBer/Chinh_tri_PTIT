# Frontend contracts

## Mục tiêu

Giữ page component độc lập với nguồn dữ liệu. Mock repository, API repository và RAG adapter phải trả về cùng model để có thể thay thế theo từng giai đoạn mà không viết lại UI.

## Class repository

```ts
listForLecturer(lecturerId): Promise<CourseClass[]>
getById(classId, { lecturerId? }): Promise<CourseClass | null>
listStudents(classId, { lecturerId?, query?, status? }): Promise<StudentEnrollment[]>
updateStudentStatus(classId, studentId, status, { lecturerId? }): Promise<StudentEnrollment | null>
getMetrics(classId, { lecturerId? }): Promise<ClassMetrics>
```

`CourseClass` được làm giàu với `subject`, `studentCount`, `questionCount` và `unansweredCount`. `StudentEnrollment` gồm hồ sơ sinh viên, `status`, `progress` và `lastActiveAt`.

## Class content repository

```ts
listLessons(classId): Promise<ScheduledLesson[]>
listAvailableLessons(classId): Promise<Lesson[]>
scheduleLesson(classId, { lessonId, date }): Promise<ScheduledLesson>
updateLessonStatus(classId, scheduledLessonId, status): Promise<ScheduledLesson | null>
listMaterials(classId): Promise<ClassMaterial[]>
listAvailableMaterials(classId): Promise<Material[]>
attachMaterial(classId, { materialId }): Promise<ClassMaterial>
updateMaterialStatus(classId, classMaterialId, status): Promise<ClassMaterial | null>
```

Bài học và học liệu mới được gắn vào lớp ở trạng thái `draft`. Học liệu khả dụng phải thuộc đúng môn và có nguồn đã duyệt.

## Subject repository

```ts
listForStudent(studentId): Promise<Subject[]>
getById(subjectId): Promise<Subject | null>
listChapters(subjectId): Promise<Chapter[]>
listLessons(chapterId): Promise<Lesson[]>
getLessonById(lessonId): Promise<Lesson | null>
listScheduledLessons(classId): Promise<ScheduledLesson[]>
```

## Learning repository

```ts
getDashboard(studentId): Promise<StudentDashboard>
listSubjectProgress(studentId): Promise<SubjectProgress[]>
getSubjectOverview(studentId, subjectId): Promise<SubjectOverview | null>
getLessonForStudent(studentId, lessonId): Promise<StudentLesson | null>
updateProgress(studentId, lessonId, progress): Promise<LearningProgress>
```

Repository kiểm tra môn học thuộc phạm vi ghi danh của sinh viên. `StudentLesson` trả về môn, chương, tiến độ và bài trước/bài tiếp theo; page không đọc trực tiếp fixture tiến độ.

## Question repository

```ts
listForStudent(studentId): Promise<StudentQuestion[]>
listForLecturer(lecturerId, { classId?, subjectId?, status?, query? }): Promise<StudentQuestion[]>
listAll(filters?): Promise<StudentQuestion[]>
getById(questionId): Promise<StudentQuestion | null>
getForStudent(questionId, studentId): Promise<StudentQuestion | null>
getForLecturer(questionId, lecturerId): Promise<StudentQuestion | null>
create({ studentId, subjectId, lessonId?, content }): Promise<StudentQuestion>
answer(questionId, { lecturerId, content }): Promise<LecturerAnswer>
listRagReviews(lecturerId, status?): Promise<StudentQuestion[]>
reviewRagResponse(responseId, { action, content?, note? }): Promise<StudentQuestion>
```

Câu hỏi trả về kèm ngữ cảnh sinh viên, lớp, môn, chương và bài học. Trong checkpoint Phase 5,
fixture có thể gắn thêm `ragRequest` và `ragResponse`; `ragResponse.isDemo` luôn là `true` và UI phải
hiển thị nhãn demo. `answer` tạo hoặc cập nhật câu trả lời trực tiếp của giảng viên. Dữ liệu fixture
không đại diện cho kết quả từ model thật.

## Search repository

```ts
search({
  query,
  studentId?,
  subjectId?,
  lessonId?,
  recordHistory?
}): Promise<SearchResult[]>
listHistory(studentId): Promise<SearchHistoryItem[]>
```

`SearchResult` tối thiểu gồm:

```ts
{
  id: string
  title: string
  excerpt: string
  sourceType: 'lesson' | 'material' | 'answer'
  sourceLabel: string
  subject?: Subject
  chapter?: Chapter
  lessonId?: string
  materialId?: string
  questionId?: string
}
```

Khi có `studentId`, repository chỉ tìm trong môn sinh viên đã ghi danh. Lịch sử chỉ được ghi khi `recordHistory` không phải `false`.

## RAG UI contract — adapter model tích hợp sau

```ts
chatRepository.createMessage({ content, subjectId }): Promise<RagAnswer>
```

`RagAnswer` tối thiểu gồm:

```ts
{
  questionId: string
  requestId: string
  responseId: string
  content: string
  reviewStatus: 'pending_review' | 'approved' | 'rejected' | 'needs_revision'
  moderation: {
    priority: 'high' | 'medium' | 'sample'
    queue: 'attention' | 'sample'
    requiresReview: boolean
    reason: string
  }
  citations: Array<{
    id: string
    title: string
    author: string
    location: string
    pageNumber?: number
    quote: string
  }>
  isDemo: boolean
}
```

Trong bản demo, repository gọi `POST /api/student/chat`. Backend tạo question, request, response và
citation trong một transaction với `model_version = demo-chat-api-v1`, sau đó trả response ngay
với `reviewStatus = pending_review` và `isDemo = true`. Retrieval/model thật sẽ thay bộ sinh nội
dung demo mà không đổi contract của page. UI hiển thị ngay mọi response; `requiresReview` chỉ điều
phối hàng đợi giảng viên, không chặn sinh viên chờ duyệt.

## Quy tắc lỗi

Mọi adapter chuẩn hóa lỗi về một `Error` có các thuộc tính:

```ts
{
  code: string
  message: string
  retryable: boolean
}
```

Các mã hiện dùng: `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`. UI phải có loading, empty, error và permission state, đồng thời không phụ thuộc message thô từ backend hoặc RAG.
