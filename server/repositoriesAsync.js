import { randomUUID } from 'node:crypto'
import { subjectMockResponses } from '../src/data/mock-student-learning.js'
import { includesNormalized } from '../src/utils/text.js'
import { buildDemoChatContent, classifyDemoModeration } from './chatDemo.js'
import { ApiError } from './http.js'
const nowIso = () => new Date().toISOString()
const createId = (prefix) => `${prefix}_${randomUUID()}`
function getExcerpt(value, maxLength = 240) {
  const plainText = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plainText.length > maxLength ? `${plainText.slice(0, maxLength).trim()}…` : plainText
}
function isUniqueConstraint(error) {
  return (
    error?.errcode === 2067 ||
    error?.code === '23505' ||
    String(error?.message).includes('UNIQUE constraint failed')
  )
}
function parseMetadata(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
async function audit(db, actorId, action, entityType, entityId, metadata = null) {
  await db.execute(
    `INSERT INTO audit_logs
     (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      createId('audit'),
      actorId ?? null,
      action,
      entityType,
      entityId ?? null,
      metadata ? JSON.stringify(metadata) : null,
      nowIso(),
    ],
  )
}
async function getOwnedClass(db, classId, lecturerId) {
  const row = await db.one(
    `SELECT
         course_classes.*,
         subjects.name AS subject_name,
         subjects.credits AS subject_credits
       FROM course_classes
       JOIN subjects ON subjects.id = course_classes.subject_id
       WHERE course_classes.id = ?`,
    [classId],
  )
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy lớp học.')
  const assignment = await db.one(
    `SELECT assignment_role
     FROM class_lecturer_assignments
     WHERE class_id = ? AND lecturer_id = ? AND status = 'active'`,
    [classId, lecturerId],
  )
  if (!assignment) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền quản lý lớp học này.')
  }
  return { ...row, assignment_role: assignment.assignment_role }
}
function mapClass(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    lecturerId: row.lecturer_id,
    assignmentRole: row.assignment_role ?? null,
    semester: row.semester,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      credits: row.subject_credits,
    },
    studentCount: Number(row.student_count ?? 0),
    questionCount: Number(row.question_count ?? 0),
    unansweredCount: Number(row.unanswered_count ?? 0),
  }
}
function mapScheduledLesson(row) {
  return {
    id: row.id,
    classId: row.class_id,
    lessonId: row.lesson_id,
    date: row.lesson_date,
    status: row.status,
    lesson: {
      id: row.lesson_id,
      chapterId: row.chapter_id,
      order: row.lesson_order,
      title: row.lesson_title,
      contentHtml: row.content_html,
    },
    chapter: {
      id: row.chapter_id,
      subjectId: row.subject_id,
      order: row.chapter_order,
      title: row.chapter_title,
    },
  }
}
function mapClassMaterial(row) {
  return {
    id: row.id,
    classId: row.class_id,
    materialId: row.material_id,
    versionId: row.version_id,
    status: row.status,
    addedAt: row.added_at,
    material: {
      id: row.material_id,
      subjectId: row.subject_id,
      title: row.material_title,
      type: row.material_type,
      author: row.material_author,
    },
    version: {
      id: row.version_id,
      materialId: row.material_id,
      year: row.version_year,
      fileUrl: row.file_url,
    },
  }
}
const QUESTION_SELECT = `
  SELECT
    questions.id,
    questions.lesson_id,
    questions.subject_id,
    questions.student_id,
    questions.content,
    questions.status,
    questions.created_at,
    questions.updated_at,
    students.name AS student_name,
    students.email AS student_email,
    subjects.name AS subject_name,
    subjects.credits AS subject_credits,
    lessons.title AS lesson_title,
    lessons.lesson_order,
    chapters.id AS chapter_id,
    chapters.title AS chapter_title,
    chapters.chapter_order,
    course_classes.id AS class_id,
    course_classes.name AS class_name,
    (
      SELECT class_lead.lecturer_id
      FROM class_lecturer_assignments AS class_lead
      WHERE class_lead.class_id = course_classes.id
        AND class_lead.status = 'active'
      ORDER BY CASE WHEN class_lead.assignment_role = 'lead' THEN 0 ELSE 1 END,
               class_lead.assigned_at
      LIMIT 1
    ) AS class_lecturer_id,
    course_classes.semester AS class_semester,
    lecturer_answers.id AS answer_id,
    lecturer_answers.lecturer_id AS answer_lecturer_id,
    lecturer_answers.content AS answer_content,
    lecturer_answers.created_at AS answer_created_at,
    lecturer_answers.updated_at AS answer_updated_at,
    mock_responses.id AS mock_id,
    mock_responses.title AS mock_title,
    mock_responses.content AS mock_content,
    mock_responses.source_label AS mock_source_label,
    mock_responses.material_id AS mock_material_id,
    mock_responses.created_at AS mock_created_at,
    rag_requests.id AS rag_request_id,
    rag_requests.status AS rag_request_status,
    rag_requests.attempt_count AS rag_attempt_count,
    rag_requests.error_code AS rag_error_code,
    rag_requests.error_message AS rag_error_message,
    rag_requests.request_json AS rag_request_json,
    rag_requests.created_at AS rag_request_created_at,
    rag_requests.completed_at AS rag_request_completed_at,
    rag_responses.id AS rag_response_id,
    rag_responses.provider_answer_id,
    rag_responses.content AS rag_content,
    rag_responses.confidence AS rag_confidence,
    rag_responses.review_status AS rag_review_status,
    rag_responses.model_version AS rag_model_version,
    rag_responses.reviewed_by AS rag_reviewed_by,
    rag_responses.reviewed_at AS rag_reviewed_at,
    rag_responses.created_at AS rag_response_created_at,
    rag_responses.updated_at AS rag_response_updated_at
  FROM questions
  JOIN users AS students ON students.id = questions.student_id
  JOIN subjects ON subjects.id = questions.subject_id
  LEFT JOIN lessons ON lessons.id = questions.lesson_id
  LEFT JOIN chapters ON chapters.id = lessons.chapter_id
  LEFT JOIN lecturer_answers ON lecturer_answers.question_id = questions.id
  LEFT JOIN mock_responses ON mock_responses.question_id = questions.id
  LEFT JOIN rag_requests
    ON rag_requests.id = (
      SELECT latest_request.id
      FROM rag_requests AS latest_request
      WHERE latest_request.question_id = questions.id
      ORDER BY latest_request.created_at DESC
      LIMIT 1
    )
  LEFT JOIN rag_responses ON rag_responses.request_id = rag_requests.id
  LEFT JOIN course_classes
    ON course_classes.id = questions.class_id
`
async function getRagCitations(db, responseId) {
  if (!responseId) return []
  return (
    await db.many(
      `SELECT
         rag_citations.*,
         materials.title AS material_title,
         materials.author AS material_author,
         material_versions.year AS material_year,
         material_versions.file_url
       FROM rag_citations
       JOIN materials ON materials.id = rag_citations.material_id
       JOIN material_versions ON material_versions.id = rag_citations.material_version_id
       WHERE rag_citations.response_id = ?
       ORDER BY rag_citations.citation_order`,
      [responseId],
    )
  ).map((citation) => ({
    id: citation.id,
    materialId: citation.material_id,
    materialVersionId: citation.material_version_id,
    pageNumber: citation.page_number,
    quote: citation.quote,
    retrievalScore: citation.retrieval_score,
    material: {
      id: citation.material_id,
      title: citation.material_title,
      author: citation.material_author,
    },
    version: {
      id: citation.material_version_id,
      year: citation.material_year,
      fileUrl: citation.file_url,
    },
  }))
}
async function mapQuestion(row, db) {
  const ragRequestMetadata = parseMetadata(row.rag_request_json)
  const moderation = ragRequestMetadata?.moderation ?? {
    priority: 'medium',
    queue: 'attention',
    requiresReview: true,
    reason: 'Dữ liệu demo cũ chưa có kết quả phân loại ưu tiên.',
  }
  return {
    id: row.id,
    lessonId: row.lesson_id,
    subjectId: row.subject_id,
    studentId: row.student_id,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: {
      id: row.student_id,
      name: row.student_name,
      email: row.student_email,
    },
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      credits: row.subject_credits,
    },
    lesson: row.lesson_id
      ? {
          id: row.lesson_id,
          chapterId: row.chapter_id,
          order: row.lesson_order,
          title: row.lesson_title,
        }
      : null,
    chapter: row.chapter_id
      ? {
          id: row.chapter_id,
          subjectId: row.subject_id,
          order: row.chapter_order,
          title: row.chapter_title,
        }
      : null,
    courseClass: row.class_id
      ? {
          id: row.class_id,
          subjectId: row.subject_id,
          name: row.class_name,
          lecturerId: row.class_lecturer_id,
          semester: row.class_semester,
        }
      : null,
    lecturerAnswer: row.answer_id
      ? {
          id: row.answer_id,
          questionId: row.id,
          lecturerId: row.answer_lecturer_id,
          content: row.answer_content,
          createdAt: row.answer_created_at,
          updatedAt: row.answer_updated_at,
        }
      : null,
    mockResponse: row.mock_id
      ? {
          id: row.mock_id,
          questionId: row.id,
          subjectId: row.subject_id,
          title: row.mock_title,
          content: row.mock_content,
          sourceLabel: row.mock_source_label,
          materialId: row.mock_material_id,
          createdAt: row.mock_created_at,
        }
      : null,
    ragRequest: row.rag_request_id
      ? {
          id: row.rag_request_id,
          questionId: row.id,
          status: row.rag_request_status,
          attemptCount: row.rag_attempt_count,
          errorCode: row.rag_error_code,
          errorMessage: row.rag_error_message,
          moderation,
          createdAt: row.rag_request_created_at,
          completedAt: row.rag_request_completed_at,
        }
      : null,
    ragResponse: row.rag_response_id
      ? {
          id: row.rag_response_id,
          requestId: row.rag_request_id,
          providerAnswerId: row.provider_answer_id,
          content: row.rag_content,
          confidence: row.rag_confidence,
          reviewStatus: row.rag_review_status,
          modelVersion: row.rag_model_version,
          isDemo: row.rag_model_version?.startsWith('demo-') ?? false,
          moderation,
          reviewedBy: row.rag_reviewed_by,
          reviewedAt: row.rag_reviewed_at,
          createdAt: row.rag_response_created_at,
          updatedAt: row.rag_response_updated_at,
          citations: await getRagCitations(db, row.rag_response_id),
        }
      : null,
  }
}
async function getStudentSubjectIds(db, studentId) {
  return (
    await db.many(
      `SELECT DISTINCT course_classes.subject_id
       FROM enrollments
       JOIN course_classes ON course_classes.id = enrollments.class_id
       WHERE enrollments.student_id = ?`,
      [studentId],
    )
  ).map((row) => row.subject_id)
}
async function ensureStudentSubjectAccess(db, studentId, subjectId) {
  if (!(await getStudentSubjectIds(db, studentId)).includes(subjectId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
  }
}
async function getStudentClassOptions(db, studentId, subjectId) {
  return db.many(
    `SELECT
       course_classes.id,
       course_classes.name,
       course_classes.subject_id,
       course_classes.semester,
       (
         SELECT class_lead.lecturer_id
         FROM class_lecturer_assignments AS class_lead
         WHERE class_lead.class_id = course_classes.id
           AND class_lead.status = 'active'
         ORDER BY CASE WHEN class_lead.assignment_role = 'lead' THEN 0 ELSE 1 END,
                  class_lead.assigned_at
         LIMIT 1
       ) AS lecturer_id,
       (
         SELECT users.name
         FROM class_lecturer_assignments AS class_lead
         JOIN users ON users.id = class_lead.lecturer_id
         WHERE class_lead.class_id = course_classes.id
           AND class_lead.status = 'active'
         ORDER BY CASE WHEN class_lead.assignment_role = 'lead' THEN 0 ELSE 1 END,
                  class_lead.assigned_at
         LIMIT 1
       ) AS lecturer_name
     FROM enrollments
     JOIN course_classes ON course_classes.id = enrollments.class_id
     WHERE enrollments.student_id = ? AND course_classes.subject_id = ?
     ORDER BY course_classes.semester DESC, course_classes.name`,
    [studentId, subjectId],
  )
}
async function getSubjectLessons(db, subjectId) {
  return (
    await db.many(
      `SELECT
         lessons.id,
         lessons.chapter_id,
         lessons.lesson_order,
         lessons.title,
         lessons.content_html,
         chapters.subject_id,
         chapters.chapter_order,
         chapters.title AS chapter_title
       FROM lessons
       JOIN chapters ON chapters.id = lessons.chapter_id
       WHERE chapters.subject_id = ?
       ORDER BY chapters.chapter_order, lessons.lesson_order`,
      [subjectId],
    )
  ).map((row) => ({
    id: row.id,
    chapterId: row.chapter_id,
    order: row.lesson_order,
    title: row.title,
    contentHtml: row.content_html,
    chapter: {
      id: row.chapter_id,
      subjectId: row.subject_id,
      order: row.chapter_order,
      title: row.chapter_title,
    },
  }))
}
async function getProgressMap(db, studentId) {
  return new Map(
    (
      await db.many(
        `SELECT lesson_id, progress, last_read_at
         FROM learning_progress
         WHERE student_id = ?`,
        [studentId],
      )
    ).map((row) => [
      row.lesson_id,
      {
        progress: row.progress,
        lastReadAt: row.last_read_at,
      },
    ]),
  )
}
function enrichLessonProgress(lesson, progressMap) {
  const progress = progressMap.get(lesson.id)
  return {
    ...lesson,
    progress: progress?.progress ?? 0,
    lastReadAt: progress?.lastReadAt ?? null,
  }
}
async function getQuestionRows(db) {
  const rows = await db.many(`${QUESTION_SELECT} GROUP BY questions.id`, [])
  const questions = []
  for (const row of rows) questions.push(await mapQuestion(row, db))
  return questions
}
async function getQuestionRowsForLecturer(db, lecturerId) {
  const rows = await db.many(
    `${QUESTION_SELECT}
     WHERE EXISTS (
       SELECT 1
       FROM class_lecturer_assignments
       WHERE class_lecturer_assignments.class_id = course_classes.id
         AND class_lecturer_assignments.lecturer_id = ?
         AND class_lecturer_assignments.status = 'active'
     )
     GROUP BY questions.id`,
    [lecturerId],
  )
  const questions = []
  for (const row of rows) questions.push(await mapQuestion(row, db))
  return questions
}

async function getLecturerSubjectIds(db, lecturerId) {
  return (
    await db.many(
      `SELECT DISTINCT course_classes.subject_id
       FROM class_lecturer_assignments
       JOIN course_classes ON course_classes.id = class_lecturer_assignments.class_id
       WHERE class_lecturer_assignments.lecturer_id = ?
         AND class_lecturer_assignments.status = 'active'`,
      [lecturerId],
    )
  ).map((row) => row.subject_id)
}

async function ensureLecturerSubjectAccess(db, lecturerId, subjectId) {
  if (!(await getLecturerSubjectIds(db, lecturerId)).includes(subjectId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn không phụ trách học phần này.')
  }
}

async function validatePracticeQuestionInput(db, input, lecturerId, { allowMissing = false } = {}) {
  const content = String(input.content ?? '').trim()
  const explanation = String(input.explanation ?? '').trim()
  const difficulty = String(input.difficulty ?? 'medium')
    .trim()
    .toLowerCase()
  const subjectId = String(input.subjectId ?? '').trim()
  const chapterId = String(input.chapterId ?? '').trim()
  const lessonId = input.lessonId ? String(input.lessonId).trim() : null
  const options = Array.isArray(input.options) ? input.options : []

  if (!subjectId || !chapterId) {
    throw new ApiError(400, 'VALIDATION', 'Cần chọn học phần và chương.')
  }
  if (!allowMissing && content.length < 10) {
    throw new ApiError(400, 'VALIDATION', 'Nội dung câu hỏi cần có ít nhất 10 ký tự.')
  }
  if (!allowMissing && explanation.length < 10) {
    throw new ApiError(400, 'VALIDATION', 'Phần giải thích cần có ít nhất 10 ký tự.')
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    throw new ApiError(400, 'VALIDATION', 'Độ khó không hợp lệ.')
  }
  if (!allowMissing && options.length !== 4) {
    throw new ApiError(400, 'VALIDATION', 'Câu hỏi phải có đúng 4 lựa chọn A, B, C và D.')
  }
  const normalizedOptions = options.map((option, index) => ({
    key: String(option.key ?? String.fromCharCode(65 + index))
      .trim()
      .toUpperCase(),
    content: String(option.content ?? '').trim(),
  }))
  if (!allowMissing) {
    if (normalizedOptions.some((option, index) => option.key !== String.fromCharCode(65 + index))) {
      throw new ApiError(400, 'VALIDATION', 'Lựa chọn phải lần lượt là A, B, C và D.')
    }
    if (normalizedOptions.some((option) => option.content.length < 1)) {
      throw new ApiError(400, 'VALIDATION', 'Không được để trống lựa chọn.')
    }
    if (new Set(normalizedOptions.map((option) => option.content.toLocaleLowerCase())).size !== 4) {
      throw new ApiError(400, 'VALIDATION', 'Các lựa chọn không được trùng nhau.')
    }
    const correctKey = String(input.correctOptionKey ?? '')
      .trim()
      .toUpperCase()
    if (!['A', 'B', 'C', 'D'].includes(correctKey)) {
      throw new ApiError(400, 'VALIDATION', 'Cần chọn đúng một đáp án.')
    }
    normalizedOptions.forEach((option) => {
      option.isCorrect = option.key === correctKey
    })
  }

  await ensureLecturerSubjectAccess(db, lecturerId, subjectId)
  const chapter = await db.one(`SELECT id, subject_id FROM chapters WHERE id = ?`, [chapterId])
  if (!chapter) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy chương.')
  if (chapter.subject_id !== subjectId) {
    throw new ApiError(400, 'VALIDATION', 'Chương không thuộc học phần đã chọn.')
  }
  if (lessonId) {
    const lesson = await db.one(`SELECT id, chapter_id FROM lessons WHERE id = ?`, [lessonId])
    if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
    if (lesson.chapter_id !== chapterId) {
      throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc chương đã chọn.')
    }
  }
  return {
    subjectId,
    chapterId,
    lessonId,
    content,
    explanation,
    difficulty,
    options: normalizedOptions,
  }
}

function mapPracticeQuestion(row, options = [], { includeAnswer = true } = {}) {
  const correctOption = options.find((option) => Number(option.is_correct) === 1)
  return {
    id: row.id,
    subjectId: row.subject_id,
    subject: row.subject_name ? { id: row.subject_id, name: row.subject_name } : null,
    chapterId: row.chapter_id,
    chapter: row.chapter_title ? { id: row.chapter_id, title: row.chapter_title } : null,
    lessonId: row.lesson_id,
    content: row.content,
    explanation: includeAnswer ? row.explanation : undefined,
    difficulty: row.difficulty,
    status: row.status,
    sourceType: row.source_type,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    options: options.map((option) => ({
      id: option.id,
      key: option.option_key,
      content: option.content,
    })),
    ...(includeAnswer && correctOption ? { correctOptionId: correctOption.id } : {}),
  }
}

async function loadPracticeQuestion(db, questionId, { includeAnswer = true } = {}) {
  const row = await db.one(
    `SELECT
       practice_questions.*,
       subjects.name AS subject_name,
       chapters.title AS chapter_title,
       users.name AS creator_name
     FROM practice_questions
     JOIN subjects ON subjects.id = practice_questions.subject_id
     JOIN chapters ON chapters.id = practice_questions.chapter_id
     JOIN users ON users.id = practice_questions.created_by
     WHERE practice_questions.id = ?`,
    [questionId],
  )
  if (!row) return null
  const options = await db.many(
    `SELECT id, option_key, content, is_correct, option_order
     FROM practice_question_options
     WHERE question_id = ?
     ORDER BY option_order`,
    [questionId],
  )
  return mapPracticeQuestion(row, options, { includeAnswer })
}
export function createAsyncRepositories(db) {
  const classRepository = {
    async listForLecturer(lecturerId) {
      return (
        await db.many(
          `SELECT
             course_classes.*,
             class_lecturer_assignments.assignment_role,
             subjects.name AS subject_name,
             subjects.credits AS subject_credits,
             (SELECT COUNT(*) FROM enrollments WHERE class_id = course_classes.id) AS student_count,
             (
               SELECT COUNT(*)
               FROM questions
               JOIN enrollments ON enrollments.student_id = questions.student_id
               WHERE enrollments.class_id = course_classes.id
                 AND questions.subject_id = course_classes.subject_id
             ) AS question_count,
             (
               SELECT COUNT(*)
               FROM questions
               JOIN enrollments ON enrollments.student_id = questions.student_id
               WHERE enrollments.class_id = course_classes.id
                 AND questions.subject_id = course_classes.subject_id
                 AND questions.status = 'unanswered'
             ) AS unanswered_count
           FROM course_classes
           JOIN class_lecturer_assignments
             ON class_lecturer_assignments.class_id = course_classes.id
           JOIN subjects ON subjects.id = course_classes.subject_id
           WHERE class_lecturer_assignments.lecturer_id = ?
             AND class_lecturer_assignments.status = 'active'
           ORDER BY course_classes.name`,
          [lecturerId],
        )
      ).map(mapClass)
    },
    async getById(classId, lecturerId) {
      await getOwnedClass(db, classId, lecturerId)
      return (await this.listForLecturer(lecturerId)).find((item) => item.id === classId) ?? null
    },
    async listStudents(classId, lecturerId, filters = {}) {
      await getOwnedClass(db, classId, lecturerId)
      const students = (
        await db.many(
          `SELECT
             users.id,
             users.name,
             users.email,
             enrollments.id AS enrollment_id,
             enrollments.class_id,
             enrollment_profiles.status,
             enrollment_profiles.progress,
             enrollment_profiles.last_active_at
           FROM enrollments
           JOIN users ON users.id = enrollments.student_id
           LEFT JOIN enrollment_profiles
             ON enrollment_profiles.enrollment_id = enrollments.id
           WHERE enrollments.class_id = ?
           ORDER BY users.name`,
          [classId],
        )
      ).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        enrollmentId: row.enrollment_id,
        classId: row.class_id,
        status: row.status ?? 'active',
        progress: row.progress ?? 0,
        lastActiveAt: row.last_active_at,
      }))
      return students.filter((student) => {
        if (filters.status && filters.status !== 'all' && student.status !== filters.status) {
          return false
        }
        if (
          filters.query &&
          !includesNormalized(student.name, filters.query) &&
          !includesNormalized(student.email, filters.query)
        ) {
          return false
        }
        return true
      })
    },
    async updateStudentStatus(classId, studentId, status, lecturerId) {
      if (!['active', 'attention', 'inactive'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái sinh viên không hợp lệ.')
      }
      await getOwnedClass(db, classId, lecturerId)
      const enrollment = await db.one(
        `SELECT
             enrollments.id,
             enrollment_profiles.status
           FROM enrollments
           LEFT JOIN enrollment_profiles
             ON enrollment_profiles.enrollment_id = enrollments.id
           WHERE enrollments.class_id = ? AND enrollments.student_id = ?`,
        [classId, studentId],
      )
      if (!enrollment) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sinh viên.')
      await db.execute(
        `INSERT INTO enrollment_profiles
         (enrollment_id, status, progress, last_active_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(enrollment_id) DO UPDATE SET status = excluded.status`,
        [enrollment.id, status, nowIso()],
      )
      await audit(db, lecturerId, 'student.status_updated', 'enrollment', enrollment.id, {
        before: enrollment.status,
        after: status,
        classId,
        studentId,
      })
      return (await this.listStudents(classId, lecturerId)).find((item) => item.id === studentId)
    },
    async getMetrics(classId, lecturerId) {
      const students = await this.listStudents(classId, lecturerId)
      if (!students.length) {
        return {
          averageProgress: 0,
          attentionCount: 0,
          inactiveCount: 0,
        }
      }
      return {
        averageProgress: Math.round(
          students.reduce((sum, student) => sum + student.progress, 0) / students.length,
        ),
        attentionCount: students.filter((item) => item.status === 'attention').length,
        inactiveCount: students.filter((item) => item.status === 'inactive').length,
      }
    },
  }
  const classContentRepository = {
    async listLessons(classId, lecturerId) {
      await getOwnedClass(db, classId, lecturerId)
      return (
        await db.many(
          `SELECT
             class_lessons.*,
             lessons.chapter_id,
             lessons.lesson_order,
             lessons.title AS lesson_title,
             lessons.content_html,
             chapters.subject_id,
             chapters.chapter_order,
             chapters.title AS chapter_title
           FROM class_lessons
           JOIN lessons ON lessons.id = class_lessons.lesson_id
           JOIN chapters ON chapters.id = lessons.chapter_id
           WHERE class_lessons.class_id = ?
           ORDER BY class_lessons.lesson_date`,
          [classId],
        )
      ).map(mapScheduledLesson)
    },
    async listAvailableLessons(classId, lecturerId) {
      const courseClass = await getOwnedClass(db, classId, lecturerId)
      return (
        await db.many(
          `SELECT
             lessons.*,
             chapters.subject_id,
             chapters.chapter_order,
             chapters.title AS chapter_title
           FROM lessons
           JOIN chapters ON chapters.id = lessons.chapter_id
           WHERE chapters.subject_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM class_lessons
               WHERE class_lessons.class_id = ?
                 AND class_lessons.lesson_id = lessons.id
             )
           ORDER BY chapters.chapter_order, lessons.lesson_order`,
          [courseClass.subject_id, classId],
        )
      ).map((row) => ({
        id: row.id,
        chapterId: row.chapter_id,
        order: row.lesson_order,
        title: row.title,
        contentHtml: row.content_html,
        chapter: {
          id: row.chapter_id,
          subjectId: row.subject_id,
          order: row.chapter_order,
          title: row.chapter_title,
        },
      }))
    },
    async scheduleLesson(classId, input, lecturerId) {
      const courseClass = await getOwnedClass(db, classId, lecturerId)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) {
        throw new ApiError(400, 'VALIDATION', 'Ngày học không hợp lệ.')
      }
      const lesson = await db.one(
        `SELECT lessons.id, chapters.subject_id
           FROM lessons
           JOIN chapters ON chapters.id = lessons.chapter_id
           WHERE lessons.id = ?`,
        [input.lessonId],
      )
      if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
      if (lesson.subject_id !== courseClass.subject_id) {
        throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn của lớp này.')
      }
      const id = createId('class_lesson')
      try {
        await db.execute(
          `INSERT INTO class_lessons
           (id, class_id, lesson_id, lesson_date, status, created_by, created_at)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
          [id, classId, input.lessonId, input.date, lecturerId, nowIso()],
        )
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Bài học đã có trong lớp.')
        }
        throw error
      }
      await audit(db, lecturerId, 'class_lesson.created', 'class_lesson', id, {
        classId,
        lessonId: input.lessonId,
      })
      return (await this.listLessons(classId, lecturerId)).find((item) => item.id === id)
    },
    async updateLessonStatus(classId, scheduledLessonId, status, lecturerId) {
      if (!['draft', 'published'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái bài học không hợp lệ.')
      }
      await getOwnedClass(db, classId, lecturerId)
      const existing = await db.one(
        'SELECT status FROM class_lessons WHERE id = ? AND class_id = ?',
        [scheduledLessonId, classId],
      )
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học trong lớp.')
      await db.execute('UPDATE class_lessons SET status = ? WHERE id = ?', [
        status,
        scheduledLessonId,
      ])
      await audit(
        db,
        lecturerId,
        'class_lesson.status_updated',
        'class_lesson',
        scheduledLessonId,
        {
          before: existing.status,
          after: status,
          classId,
        },
      )
      return (await this.listLessons(classId, lecturerId)).find(
        (item) => item.id === scheduledLessonId,
      )
    },
    async listMaterials(classId, lecturerId) {
      await getOwnedClass(db, classId, lecturerId)
      return (
        await db.many(
          `SELECT
             class_materials.*,
             materials.subject_id,
             materials.title AS material_title,
             materials.type AS material_type,
             materials.author AS material_author,
             material_versions.year AS version_year,
             material_versions.file_url
           FROM class_materials
           JOIN materials ON materials.id = class_materials.material_id
           JOIN material_versions ON material_versions.id = class_materials.version_id
           WHERE class_materials.class_id = ?
           ORDER BY class_materials.added_at DESC`,
          [classId],
        )
      ).map(mapClassMaterial)
    },
    async listAvailableMaterials(classId, lecturerId) {
      const courseClass = await getOwnedClass(db, classId, lecturerId)
      const materials = await db.many(
        `SELECT materials.*
         FROM materials
         JOIN approved_sources
           ON approved_sources.material_id = materials.id
          AND approved_sources.is_approved = 1
         WHERE materials.subject_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM class_materials
             WHERE class_materials.class_id = ?
               AND class_materials.material_id = materials.id
           )
         ORDER BY materials.title`,
        [courseClass.subject_id, classId],
      )
      return Promise.all(
        materials.map(async (row) => ({
          id: row.id,
          subjectId: row.subject_id,
          title: row.title,
          type: row.type,
          author: row.author,
          versions: (
            await db.many(
              `SELECT id, material_id, year, file_url
             FROM material_versions
             WHERE material_id = ?
             ORDER BY year DESC`,
              [row.id],
            )
          ).map((version) => ({
            id: version.id,
            materialId: version.material_id,
            year: version.year,
            fileUrl: version.file_url,
          })),
        })),
      )
    },
    async attachMaterial(classId, input, lecturerId) {
      const courseClass = await getOwnedClass(db, classId, lecturerId)
      const material = await db.one(
        `SELECT materials.*
           FROM materials
           JOIN approved_sources
             ON approved_sources.material_id = materials.id
            AND approved_sources.is_approved = 1
           WHERE materials.id = ?`,
        [input.materialId],
      )
      if (!material) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy học liệu đã duyệt.')
      }
      if (material.subject_id !== courseClass.subject_id) {
        throw new ApiError(400, 'VALIDATION', 'Học liệu không thuộc môn của lớp này.')
      }
      const version = await db.one(
        `SELECT * FROM material_versions
           WHERE material_id = ?
           ORDER BY year DESC
           LIMIT 1`,
        [material.id],
      )
      if (!version) {
        throw new ApiError(404, 'NOT_FOUND', 'Học liệu chưa có phiên bản khả dụng.')
      }
      const id = createId('class_material')
      try {
        await db.execute(
          `INSERT INTO class_materials
           (id, class_id, material_id, version_id, status, added_by, added_at)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
          [id, classId, material.id, version.id, lecturerId, nowIso()],
        )
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Học liệu đã được gắn vào lớp.')
        }
        throw error
      }
      await audit(db, lecturerId, 'class_material.created', 'class_material', id, {
        classId,
        materialId: material.id,
        versionId: version.id,
      })
      return (await this.listMaterials(classId, lecturerId)).find((item) => item.id === id)
    },
    async updateMaterialStatus(classId, classMaterialId, status, lecturerId) {
      if (!['draft', 'published'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái học liệu không hợp lệ.')
      }
      await getOwnedClass(db, classId, lecturerId)
      const existing = await db.one(
        'SELECT status FROM class_materials WHERE id = ? AND class_id = ?',
        [classMaterialId, classId],
      )
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy học liệu trong lớp.')
      await db.execute('UPDATE class_materials SET status = ? WHERE id = ?', [
        status,
        classMaterialId,
      ])
      await audit(
        db,
        lecturerId,
        'class_material.status_updated',
        'class_material',
        classMaterialId,
        {
          before: existing.status,
          after: status,
          classId,
        },
      )
      return (await this.listMaterials(classId, lecturerId)).find(
        (item) => item.id === classMaterialId,
      )
    },
    async addMaterialVersion(materialId, input, lecturerId) {
      const material = await db.one(
        `SELECT materials.*
           FROM materials
           WHERE materials.id = ?
             AND EXISTS (
               SELECT 1
               FROM course_classes
               JOIN class_lecturer_assignments
                 ON class_lecturer_assignments.class_id = course_classes.id
               WHERE course_classes.subject_id = materials.subject_id
                 AND class_lecturer_assignments.lecturer_id = ?
                 AND class_lecturer_assignments.status = 'active'
             )`,
        [materialId, lecturerId],
      )
      if (!material) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn không thể cập nhật học liệu này.')
      }
      const year = Number(input.year)
      if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        throw new ApiError(400, 'VALIDATION', 'Năm phiên bản không hợp lệ.')
      }
      if (!String(input.fileUrl ?? '').trim()) {
        throw new ApiError(400, 'VALIDATION', 'Đường dẫn tệp không được để trống.')
      }
      const id = createId('material_version')
      try {
        await db.execute(
          `INSERT INTO material_versions
           (id, material_id, year, file_url, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, materialId, year, input.fileUrl.trim(), lecturerId, nowIso()],
        )
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Phiên bản năm này đã tồn tại.')
        }
        throw error
      }
      await audit(db, lecturerId, 'material_version.created', 'material_version', id, {
        materialId,
        year,
        fileUrl: input.fileUrl.trim(),
      })
      return {
        id,
        materialId,
        year,
        fileUrl: input.fileUrl.trim(),
      }
    },
  }
  const questionRepository = {
    async listForLecturer(lecturerId, filters = {}) {
      return (await getQuestionRowsForLecturer(db, lecturerId))
        .filter((question) => {
          if (filters.classId && question.courseClass?.id !== filters.classId) return false
          if (filters.subjectId && question.subjectId !== filters.subjectId) return false
          if (filters.status && filters.status !== 'all' && question.status !== filters.status) {
            return false
          }
          if (
            filters.query &&
            !includesNormalized(question.content, filters.query) &&
            !includesNormalized(question.student.name, filters.query)
          ) {
            return false
          }
          return true
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    async listForStudent(studentId) {
      return (await getQuestionRows(db))
        .filter((question) => question.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    async getForLecturer(questionId, lecturerId) {
      const question = (await this.listForLecturer(lecturerId)).find(
        (item) => item.id === questionId,
      )
      if (!question) {
        const exists = await db.one('SELECT id FROM questions WHERE id = ?', [questionId])
        if (exists) {
          throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xử lý câu hỏi này.')
        }
        return null
      }
      return question
    },
    async getForStudent(questionId, studentId) {
      const question = (await getQuestionRows(db)).find((item) => item.id === questionId)
      if (!question) return null
      if (question.studentId !== studentId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem câu hỏi này.')
      }
      return question
    },
    async create(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
      }
      await ensureStudentSubjectAccess(db, studentId, input.subjectId)
      if (input.lessonId) {
        const lesson = await db.one(
          `SELECT chapters.subject_id
             FROM lessons
             JOIN chapters ON chapters.id = lessons.chapter_id
             WHERE lessons.id = ?`,
          [input.lessonId],
        )
        if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
        if (lesson.subject_id !== input.subjectId) {
          throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn đã chọn.')
        }
      }
      const id = createId('question')
      const createdAt = nowIso()
      const classOptions = await getStudentClassOptions(db, studentId, input.subjectId)
      const courseClass = input.classId
        ? classOptions.find((item) => item.id === input.classId)
        : classOptions.length === 1
          ? classOptions[0]
          : null
      if (input.classId && !courseClass) {
        throw new ApiError(403, 'FORBIDDEN', 'Lớp tín chỉ không thuộc tài khoản sinh viên.')
      }
      if (!input.classId && classOptions.length > 1) {
        throw new ApiError(400, 'VALIDATION', 'Vui lòng chọn lớp tín chỉ cần gửi câu hỏi.')
      }
      const activeLecturers = courseClass
        ? await db.one(
            `SELECT COUNT(*) AS count
             FROM class_lecturer_assignments
             WHERE class_id = ? AND status = 'active'`,
            [courseClass.id],
          )
        : { count: 0 }
      const routingStatus = courseClass && Number(activeLecturers.count) > 0 ? 'queued' : 'unrouted'
      await db.execute(
        `INSERT INTO questions
         (id, lesson_id, subject_id, student_id, class_id, routing_status,
          content, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
        [
          id,
          input.lessonId ?? null,
          input.subjectId,
          studentId,
          courseClass?.id ?? null,
          routingStatus,
          content,
          createdAt,
          createdAt,
        ],
      )
      await audit(db, studentId, 'question.created', 'question', id, {
        subjectId: input.subjectId,
        lessonId: input.lessonId ?? null,
        classId: courseClass?.id ?? null,
        routingStatus,
      })
      return this.getForStudent(id, studentId)
    },
    async answer(questionId, input, lecturerId) {
      const question = await this.getForLecturer(questionId, lecturerId)
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      const content = String(input.content ?? '').trim()
      if (!content) {
        throw new ApiError(400, 'VALIDATION', 'Câu trả lời không được để trống.')
      }
      const existing = await db.one('SELECT * FROM lecturer_answers WHERE question_id = ?', [
        questionId,
      ])
      const timestamp = nowIso()
      let answerId
      if (existing) {
        answerId = existing.id
        await db.execute(
          `UPDATE lecturer_answers
           SET content = ?, updated_at = ?
           WHERE id = ?`,
          [content, timestamp, answerId],
        )
      } else {
        answerId = createId('answer')
        await db.execute(
          `INSERT INTO lecturer_answers
           (id, question_id, lecturer_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
          [answerId, questionId, lecturerId, content, timestamp],
        )
      }
      await db.execute(
        `UPDATE questions
         SET status = 'answered', updated_at = ?
         WHERE id = ?`,
        [timestamp, questionId],
      )
      await audit(
        db,
        lecturerId,
        existing ? 'answer.updated' : 'answer.created',
        'question',
        questionId,
        {
          answerId,
          previousContent: existing?.content ?? null,
        },
      )
      return (await this.getForLecturer(questionId, lecturerId)).lecturerAnswer
    },
  }
  const practiceQuestionRepository = {
    async listForLecturer(lecturerId, filters = {}) {
      const rows = await db.many(
        `SELECT
           practice_questions.*,
           subjects.name AS subject_name,
           chapters.title AS chapter_title,
           users.name AS creator_name
         FROM practice_questions
         JOIN subjects ON subjects.id = practice_questions.subject_id
         JOIN chapters ON chapters.id = practice_questions.chapter_id
         JOIN users ON users.id = practice_questions.created_by
         WHERE EXISTS (
           SELECT 1
           FROM course_classes
           JOIN class_lecturer_assignments
             ON class_lecturer_assignments.class_id = course_classes.id
           WHERE course_classes.subject_id = practice_questions.subject_id
             AND class_lecturer_assignments.lecturer_id = ?
             AND class_lecturer_assignments.status = 'active'
         )
         ORDER BY practice_questions.updated_at DESC`,
        [lecturerId],
      )
      const scoped = rows.filter((row) => {
        if (filters.subjectId && row.subject_id !== filters.subjectId) return false
        if (filters.chapterId && row.chapter_id !== filters.chapterId) return false
        if (filters.query && !includesNormalized(row.content, filters.query)) return false
        return true
      })
      const filtered = scoped.filter(
        (row) => !filters.status || filters.status === 'all' || row.status === filters.status,
      )
      const page = Math.max(Number(filters.page) || 1, 1)
      const pageSize = Math.min(Math.max(Number(filters.pageSize) || 12, 1), 50)
      const offset = (page - 1) * pageSize
      const pageRows = filtered.slice(offset, offset + pageSize)
      const counts = scoped.reduce(
        (result, row) => ({ ...result, [row.status]: (result[row.status] ?? 0) + 1 }),
        { draft: 0, published: 0, archived: 0 },
      )
      const items = await Promise.all(
        pageRows.map(async (row) => {
          const options = await db.many(
            `SELECT id, option_key, content, is_correct, option_order
             FROM practice_question_options
             WHERE question_id = ? ORDER BY option_order`,
            [row.id],
          )
          return mapPracticeQuestion(row, options)
        }),
      )
      return { items, total: filtered.length, page, pageSize, counts }
    },
    async getForLecturer(questionId, lecturerId) {
      const question = await loadPracticeQuestion(db, questionId)
      if (!question) return null
      await ensureLecturerSubjectAccess(db, lecturerId, question.subjectId)
      return question
    },
    async create(input, lecturerId) {
      const normalized = await validatePracticeQuestionInput(db, input, lecturerId)
      const id = createId('practice_question')
      const createdAt = nowIso()
      try {
        await db.transaction(async (transaction) => {
          await transaction.execute(
            `INSERT INTO practice_questions
             (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
              source_type, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'manual', ?, ?, ?)`,
            [
              id,
              normalized.subjectId,
              normalized.chapterId,
              normalized.lessonId,
              normalized.content,
              normalized.explanation,
              normalized.difficulty,
              lecturerId,
              createdAt,
              createdAt,
            ],
          )
          for (const [index, option] of normalized.options.entries()) {
            await transaction.execute(
              `INSERT INTO practice_question_options
               (id, question_id, option_key, content, is_correct, option_order)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                createId('practice_option'),
                id,
                option.key,
                option.content,
                option.isCorrect ? 1 : 0,
                index + 1,
              ],
            )
          }
          await audit(
            transaction,
            lecturerId,
            'practice_question.created',
            'practice_question',
            id,
            {
              subjectId: normalized.subjectId,
              chapterId: normalized.chapterId,
              sourceType: 'manual',
            },
          )
        })
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Câu hỏi này đã tồn tại trong học phần.')
        }
        throw error
      }
      return this.getForLecturer(id, lecturerId)
    },
    async importDrafts(input, lecturerId) {
      const questions = Array.isArray(input.questions) ? input.questions : []
      if (!questions.length) {
        throw new ApiError(400, 'VALIDATION', 'File CSV chưa có câu hỏi hợp lệ để nhập.')
      }
      if (questions.length > 200) {
        throw new ApiError(400, 'VALIDATION', 'Mỗi lần chỉ được nhập tối đa 200 câu hỏi.')
      }

      const normalizedQuestions = []
      const seenContents = new Set()
      for (const [index, question] of questions.entries()) {
        try {
          const normalized = await validatePracticeQuestionInput(
            db,
            {
              ...question,
              subjectId: input.subjectId,
              chapterId: input.chapterId,
              lessonId: input.lessonId,
            },
            lecturerId,
          )
          const contentKey = normalized.content.toLocaleLowerCase()
          if (seenContents.has(contentKey)) {
            throw new ApiError(400, 'VALIDATION', 'Nội dung bị trùng trong cùng file CSV.')
          }
          seenContents.add(contentKey)
          normalizedQuestions.push(normalized)
        } catch (error) {
          if (error instanceof ApiError) {
            throw new ApiError(error.status, error.code, `Dòng ${index + 2}: ${error.message}`)
          }
          throw error
        }
      }

      const normalizedContents = normalizedQuestions.map((question) =>
        question.content.toLocaleLowerCase(),
      )
      const contentPlaceholders = normalizedContents.map(() => '?').join(', ')
      const existingQuestions = await db.many(
        `SELECT content
         FROM practice_questions
         WHERE subject_id = ?
           AND LOWER(content) IN (${contentPlaceholders})`,
        [input.subjectId, ...normalizedContents],
      )
      const existingContents = new Set(
        existingQuestions.map((question) => question.content.toLocaleLowerCase()),
      )
      const duplicateIndex = normalizedQuestions.findIndex((question) =>
        existingContents.has(question.content.toLocaleLowerCase()),
      )
      if (duplicateIndex >= 0) {
        throw new ApiError(
          409,
          'CONFLICT',
          `Dòng ${duplicateIndex + 2}: câu hỏi đã tồn tại trong học phần.`,
        )
      }

      const createdAt = nowIso()
      const ids = normalizedQuestions.map(() => createId('practice_question'))
      try {
        await db.transaction(async (transaction) => {
          for (const [questionIndex, question] of normalizedQuestions.entries()) {
            const questionId = ids[questionIndex]
            await transaction.execute(
              `INSERT INTO practice_questions
               (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
                source_type, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'csv', ?, ?, ?)`,
              [
                questionId,
                question.subjectId,
                question.chapterId,
                question.lessonId,
                question.content,
                question.explanation,
                question.difficulty,
                lecturerId,
                createdAt,
                createdAt,
              ],
            )
            for (const [optionIndex, option] of question.options.entries()) {
              await transaction.execute(
                `INSERT INTO practice_question_options
                 (id, question_id, option_key, content, is_correct, option_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  createId('practice_option'),
                  questionId,
                  option.key,
                  option.content,
                  option.isCorrect ? 1 : 0,
                  optionIndex + 1,
                ],
              )
            }
          }
          await audit(
            transaction,
            lecturerId,
            'practice_question.csv_imported',
            'practice_question_batch',
            createId('practice_import'),
            {
              subjectId: input.subjectId,
              chapterId: input.chapterId,
              lessonId: input.lessonId ?? null,
              importedCount: ids.length,
            },
          )
        })
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'File CSV có câu hỏi đã tồn tại trong học phần.')
        }
        throw error
      }

      return { importedCount: ids.length, ids, status: 'draft' }
    },
    async update(questionId, input, lecturerId) {
      const existing = await db.one(`SELECT * FROM practice_questions WHERE id = ?`, [questionId])
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (existing.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được sửa câu hỏi do mình tạo.')
      }
      const normalized = await validatePracticeQuestionInput(db, input, lecturerId)
      const updatedAt = nowIso()
      try {
        await db.transaction(async (transaction) => {
          const existingOptions = await transaction.many(
            `SELECT id, option_key
             FROM practice_question_options
             WHERE question_id = ?`,
            [questionId],
          )
          await transaction.execute(
            `UPDATE practice_questions
             SET subject_id = ?, chapter_id = ?, lesson_id = ?, content = ?, explanation = ?,
                 difficulty = ?, updated_at = ?
             WHERE id = ?`,
            [
              normalized.subjectId,
              normalized.chapterId,
              normalized.lessonId,
              normalized.content,
              normalized.explanation,
              normalized.difficulty,
              updatedAt,
              questionId,
            ],
          )
          for (const [index, option] of normalized.options.entries()) {
            const existingOption = existingOptions.find((item) => item.option_key === option.key)
            if (existingOption) {
              await transaction.execute(
                `UPDATE practice_question_options
                 SET content = ?, is_correct = ?, option_order = ?
                 WHERE id = ?`,
                [option.content, option.isCorrect ? 1 : 0, index + 1, existingOption.id],
              )
            } else {
              await transaction.execute(
                `INSERT INTO practice_question_options
                 (id, question_id, option_key, content, is_correct, option_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  createId('practice_option'),
                  questionId,
                  option.key,
                  option.content,
                  option.isCorrect ? 1 : 0,
                  index + 1,
                ],
              )
            }
          }
          await audit(
            transaction,
            lecturerId,
            'practice_question.updated',
            'practice_question',
            questionId,
            {
              subjectId: normalized.subjectId,
              chapterId: normalized.chapterId,
            },
          )
        })
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Câu hỏi này đã tồn tại trong học phần.')
        }
        throw error
      }
      return this.getForLecturer(questionId, lecturerId)
    },
    async saveDraft(questionId, lecturerId) {
      const question = await db.one('SELECT * FROM practice_questions WHERE id = ?', [questionId])
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (question.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được lưu nháp câu hỏi do mình tạo.')
      }
      await ensureLecturerSubjectAccess(db, lecturerId, question.subject_id)
      if (question.status === 'archived') {
        throw new ApiError(409, 'CONFLICT', 'Cần khôi phục câu hỏi trước khi lưu thành bản nháp.')
      }
      await db.execute(
        `UPDATE practice_questions
         SET status = 'draft', published_by = NULL, published_at = NULL, updated_at = ?
         WHERE id = ?`,
        [nowIso(), questionId],
      )
      await audit(
        db,
        lecturerId,
        'practice_question.saved_as_draft',
        'practice_question',
        questionId,
      )
      return this.getForLecturer(questionId, lecturerId)
    },
    async publish(questionId, lecturerId) {
      const question = await db.one('SELECT * FROM practice_questions WHERE id = ?', [questionId])
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (question.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được xuất bản câu hỏi do mình tạo.')
      }
      await ensureLecturerSubjectAccess(db, lecturerId, question.subject_id)
      const validation = await db.one(
        `SELECT
           COUNT(*) AS option_count,
           SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
         FROM practice_question_options WHERE question_id = ?`,
        [questionId],
      )
      if (Number(validation.option_count) !== 4 || Number(validation.correct_count) !== 1) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi phải có đúng 4 lựa chọn và một đáp án đúng.')
      }
      const timestamp = nowIso()
      await db.execute(
        `UPDATE practice_questions
         SET status = 'published', published_by = ?, published_at = ?, updated_at = ?
         WHERE id = ?`,
        [lecturerId, timestamp, timestamp, questionId],
      )
      await audit(db, lecturerId, 'practice_question.published', 'practice_question', questionId)
      return this.getForLecturer(questionId, lecturerId)
    },
    async archive(questionId, lecturerId) {
      const question = await db.one('SELECT * FROM practice_questions WHERE id = ?', [questionId])
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (question.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được lưu trữ câu hỏi do mình tạo.')
      }
      await ensureLecturerSubjectAccess(db, lecturerId, question.subject_id)
      await db.execute(
        `UPDATE practice_questions SET status = 'archived', updated_at = ? WHERE id = ?`,
        [nowIso(), questionId],
      )
      await audit(db, lecturerId, 'practice_question.archived', 'practice_question', questionId)
      return this.getForLecturer(questionId, lecturerId)
    },
    async restore(questionId, lecturerId) {
      const question = await db.one('SELECT * FROM practice_questions WHERE id = ?', [questionId])
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (question.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được khôi phục câu hỏi do mình tạo.')
      }
      await ensureLecturerSubjectAccess(db, lecturerId, question.subject_id)
      if (question.status !== 'archived') {
        throw new ApiError(409, 'CONFLICT', 'Chỉ câu hỏi đã lưu trữ mới có thể khôi phục.')
      }
      const timestamp = nowIso()
      await db.execute(
        `UPDATE practice_questions
         SET status = 'draft', updated_at = ?
         WHERE id = ?`,
        [timestamp, questionId],
      )
      await audit(db, lecturerId, 'practice_question.restored', 'practice_question', questionId)
      return this.getForLecturer(questionId, lecturerId)
    },
    async remove(questionId, lecturerId) {
      const question = await db.one('SELECT * FROM practice_questions WHERE id = ?', [questionId])
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      if (question.created_by !== lecturerId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chỉ được xóa câu hỏi do mình tạo.')
      }
      await ensureLecturerSubjectAccess(db, lecturerId, question.subject_id)
      if (question.status !== 'archived') {
        throw new ApiError(409, 'CONFLICT', 'Chỉ câu hỏi đã lưu trữ mới có thể xóa vĩnh viễn.')
      }
      const usage = await db.one(
        `SELECT COUNT(*) AS usage_count
         FROM practice_session_questions
         WHERE question_id = ?`,
        [questionId],
      )
      if (Number(usage?.usage_count ?? 0) > 0) {
        throw new ApiError(
          409,
          'CONFLICT',
          'Câu hỏi đã được dùng trong phiên luyện tập và chỉ có thể lưu trữ.',
        )
      }
      await db.transaction(async (transaction) => {
        await transaction.execute('DELETE FROM practice_question_options WHERE question_id = ?', [
          questionId,
        ])
        await transaction.execute('DELETE FROM practice_questions WHERE id = ?', [questionId])
        await audit(
          transaction,
          lecturerId,
          'practice_question.deleted',
          'practice_question',
          questionId,
        )
      })
      return { id: questionId, deleted: true }
    },
  }
  const practiceSessionRepository = {
    async getConfig(studentId, subjectId) {
      await ensureStudentSubjectAccess(db, studentId, subjectId)
      const subject = await db.one('SELECT id, name FROM subjects WHERE id = ?', [subjectId])
      const classes = await getStudentClassOptions(db, studentId, subjectId)
      const chapters = await db.many(
        `SELECT
           chapters.id,
           chapters.title,
           chapters.chapter_order,
           COUNT(practice_questions.id) AS question_count
         FROM chapters
         LEFT JOIN practice_questions
           ON practice_questions.chapter_id = chapters.id
          AND practice_questions.status = 'published'
         WHERE chapters.subject_id = ?
         GROUP BY chapters.id, chapters.title, chapters.chapter_order
         ORDER BY chapters.chapter_order`,
        [subjectId],
      )
      return {
        subject,
        classes: classes.map((row) => ({
          id: row.id,
          name: row.name,
          subjectId: row.subject_id,
          semester: row.semester,
          lecturerId: row.lecturer_id,
          lecturerName: row.lecturer_name,
        })),
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          order: chapter.chapter_order,
          questionCount: Number(chapter.question_count ?? 0),
        })),
      }
    },
    async create(input, studentId) {
      const subjectId = String(input.subjectId ?? '').trim()
      const chapterId = input.chapterId ? String(input.chapterId).trim() : null
      const requestedCount = Number(input.questionCount ?? 10)
      const mode = String(input.mode ?? 'standard')
        .trim()
        .toLowerCase()
      const sessionType =
        mode === 'retry_wrong'
          ? 'practice'
          : String(input.sessionType ?? 'practice')
              .trim()
              .toLowerCase()
      const randomize = input.randomize !== false
      const requestedClassId = input.classId ? String(input.classId).trim() : null
      const sourceSessionId = input.sourceSessionId ? String(input.sourceSessionId).trim() : null
      if (!['standard', 'retry_wrong'].includes(mode)) {
        throw new ApiError(400, 'VALIDATION', 'Practice mode is invalid.')
      }
      if (!['practice', 'mock_exam'].includes(sessionType)) {
        throw new ApiError(400, 'VALIDATION', 'Loại phiên làm bài không hợp lệ.')
      }
      if (!subjectId) throw new ApiError(400, 'VALIDATION', 'Cần chọn học phần.')
      if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 50) {
        throw new ApiError(400, 'VALIDATION', 'Số câu luyện tập phải từ 1 đến 50.')
      }
      await ensureStudentSubjectAccess(db, studentId, subjectId)
      const classOptions = await getStudentClassOptions(db, studentId, subjectId)
      const selectedClass = requestedClassId
        ? classOptions.find((item) => item.id === requestedClassId)
        : classOptions[0]
      if (!selectedClass) {
        throw new ApiError(403, 'FORBIDDEN', 'Class is outside the student enrollment scope.')
      }
      if (chapterId) {
        const chapter = await db.one('SELECT id, subject_id FROM chapters WHERE id = ?', [
          chapterId,
        ])
        if (!chapter) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy chương.')
        if (chapter.subject_id !== subjectId) {
          throw new ApiError(400, 'VALIDATION', 'Chương không thuộc học phần đã chọn.')
        }
      }
      let questionRows
      if (mode === 'retry_wrong') {
        if (!sourceSessionId) {
          throw new ApiError(400, 'VALIDATION', 'A source session is required for retry mode.')
        }
        const sourceSession = await db.one(
          `SELECT id, subject_id FROM practice_sessions
           WHERE id = ? AND student_id = ?`,
          [sourceSessionId, studentId],
        )
        if (!sourceSession)
          throw new ApiError(404, 'NOT_FOUND', 'Source practice session not found.')
        if (sourceSession.subject_id !== subjectId) {
          throw new ApiError(400, 'VALIDATION', 'Source session belongs to another subject.')
        }
        questionRows = (
          await db.many(
            `SELECT question_id AS id
           FROM practice_session_questions
           WHERE session_id = ? AND is_correct = 0
           ORDER BY position`,
            [sourceSessionId],
          )
        ).slice(0, requestedCount)
      } else {
        const filters = chapterId ? `AND practice_questions.chapter_id = ?` : ''
        const scopeParams = chapterId ? [subjectId, chapterId] : [subjectId]
        const available = await db.one(
          `SELECT COUNT(*) AS question_count
           FROM practice_questions
           WHERE practice_questions.subject_id = ?
             AND practice_questions.status = 'published'
             ${filters}`,
          scopeParams,
        )
        const availableCount = Number(available?.question_count ?? 0)
        const sampleSize = Math.min(requestedCount, availableCount)
        questionRows = await db.many(
          `SELECT practice_questions.id
           FROM practice_questions
           WHERE practice_questions.subject_id = ?
             AND practice_questions.status = 'published'
             ${filters}
           ORDER BY ${randomize ? 'RANDOM()' : 'practice_questions.id'}
           LIMIT ?`,
          [...scopeParams, sampleSize],
        )
      }
      if (questionRows.length === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Chưa có câu hỏi đã xuất bản trong phạm vi này.')
      }
      const sessionId = createId('practice_session')
      const startedAt = nowIso()
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `INSERT INTO practice_sessions
           (id, student_id, subject_id, chapter_id, class_id, mode, session_type, source_session_id,
            status, question_count, answered_count, correct_count, started_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, 0, 0, ?, ?)`,
          [
            sessionId,
            studentId,
            subjectId,
            chapterId,
            selectedClass.id,
            mode,
            sessionType,
            sourceSessionId,
            questionRows.length,
            startedAt,
            startedAt,
          ],
        )
        for (const [index, question] of questionRows.entries()) {
          await transaction.execute(
            `INSERT INTO practice_session_questions
             (id, session_id, question_id, position, started_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              createId('practice_session_question'),
              sessionId,
              question.id,
              index + 1,
              index === 0 ? startedAt : null,
            ],
          )
        }
        await audit(
          transaction,
          studentId,
          'practice_session.created',
          'practice_session',
          sessionId,
          {
            subjectId,
            chapterId,
            classId: selectedClass.id,
            mode,
            sessionType,
            randomize,
            sourceSessionId,
            questionCount: questionRows.length,
          },
        )
      })
      return this.get(sessionId, studentId)
    },
    async get(sessionId, studentId) {
      const session = await db.one(
        `SELECT * FROM practice_sessions WHERE id = ? AND student_id = ?`,
        [sessionId, studentId],
      )
      if (!session) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phiên luyện tập.')
      const rows = await db.many(
        `SELECT id, question_id, position, selected_option_id, is_correct, answered_at,
                started_at, answer_duration_ms
         FROM practice_session_questions
         WHERE session_id = ? ORDER BY position`,
        [sessionId],
      )
      const sessionType = session.session_type ?? 'practice'
      const revealAnswers = sessionType === 'practice' || session.status === 'completed'
      const questions = await Promise.all(
        rows.map(async (row) => {
          const isAnswered = row.selected_option_id !== null
          return {
            id: row.id,
            position: row.position,
            selectedOptionId: row.selected_option_id,
            isAnswered,
            isCorrect:
              isAnswered && revealAnswers && row.is_correct !== null
                ? Number(row.is_correct) === 1
                : null,
            answeredAt: row.answered_at,
            startedAt: row.started_at,
            answerDurationMs:
              row.answer_duration_ms == null ? null : Number(row.answer_duration_ms),
            question: await loadPracticeQuestion(db, row.question_id, {
              includeAnswer: isAnswered && revealAnswers,
            }),
          }
        }),
      )
      return {
        id: session.id,
        subjectId: session.subject_id,
        chapterId: session.chapter_id,
        classId: session.class_id,
        mode: session.mode ?? 'standard',
        sessionType,
        sourceSessionId: session.source_session_id,
        status: session.status,
        questionCount: Number(session.question_count),
        answeredCount: Number(session.answered_count),
        correctCount:
          sessionType === 'mock_exam' && session.status !== 'completed'
            ? null
            : Number(session.correct_count),
        startedAt: session.started_at,
        completedAt: session.completed_at,
        updatedAt: session.updated_at,
        currentQuestionId: questions.find((item) => !item.isAnswered)?.id ?? null,
        questions,
      }
    },
    async answer(sessionId, input, studentId) {
      const session = await db.one(
        `SELECT * FROM practice_sessions WHERE id = ? AND student_id = ?`,
        [sessionId, studentId],
      )
      if (!session) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phiên luyện tập.')
      if (session.status !== 'in_progress') {
        throw new ApiError(409, 'CONFLICT', 'Phiên luyện tập đã kết thúc.')
      }
      const sessionQuestion = await db.one(
        `SELECT practice_session_questions.*, practice_questions.explanation
         FROM practice_session_questions
         JOIN practice_questions ON practice_questions.id = practice_session_questions.question_id
         WHERE practice_session_questions.session_id = ?
           AND practice_session_questions.question_id = ?`,
        [sessionId, input.questionId],
      )
      if (!sessionQuestion) throw new ApiError(404, 'NOT_FOUND', 'Câu hỏi không thuộc phiên này.')
      const sessionType = session.session_type ?? 'practice'
      const isAnswerChange = Boolean(sessionQuestion.selected_option_id)
      if (isAnswerChange && sessionType !== 'mock_exam') {
        throw new ApiError(409, 'CONFLICT', 'Câu hỏi này đã được trả lời.')
      }
      const option = await db.one(
        `SELECT id, question_id, is_correct
         FROM practice_question_options
         WHERE id = ? AND question_id = ?`,
        [input.optionId, input.questionId],
      )
      if (!option) throw new ApiError(400, 'VALIDATION', 'Lựa chọn không hợp lệ.')
      const isCorrect = Number(option.is_correct) === 1
      const answeredAt = nowIso()
      const answerDurationMs = sessionQuestion.started_at
        ? Math.max(
            0,
            new Date(answeredAt).getTime() - new Date(sessionQuestion.started_at).getTime(),
          )
        : null
      await db.transaction(async (transaction) => {
        if (isAnswerChange) {
          const previousCorrect = Number(sessionQuestion.is_correct) === 1
          const correctDelta = Number(isCorrect) - Number(previousCorrect)
          const updateResult = await transaction.execute(
            `UPDATE practice_session_questions
             SET selected_option_id = ?, is_correct = ?, answered_at = ?
             WHERE id = ? AND selected_option_id = ?`,
            [
              option.id,
              isCorrect ? 1 : 0,
              answeredAt,
              sessionQuestion.id,
              sessionQuestion.selected_option_id,
            ],
          )
          const changed = Number(updateResult?.changes ?? updateResult?.rowCount ?? 0)
          if (changed !== 1) {
            throw new ApiError(409, 'CONFLICT', 'Đáp án vừa được cập nhật ở phiên khác.')
          }
          await transaction.execute(
            `UPDATE practice_sessions
             SET correct_count = correct_count + ?, updated_at = ?
             WHERE id = ?`,
            [correctDelta, answeredAt, sessionId],
          )
          return
        }

        const updateResult = await transaction.execute(
          `UPDATE practice_session_questions
           SET selected_option_id = ?, is_correct = ?, answered_at = ?, answer_duration_ms = ?
           WHERE id = ? AND selected_option_id IS NULL`,
          [option.id, isCorrect ? 1 : 0, answeredAt, answerDurationMs, sessionQuestion.id],
        )
        const changed = Number(updateResult?.changes ?? updateResult?.rowCount ?? 0)
        if (changed !== 1) throw new ApiError(409, 'CONFLICT', 'Câu hỏi này đã được trả lời.')
        await transaction.execute(
          `UPDATE practice_sessions
           SET answered_count = answered_count + 1,
               correct_count = correct_count + ?,
               updated_at = ?
           WHERE id = ?`,
          [isCorrect ? 1 : 0, answeredAt, sessionId],
        )
        const nextQuestion = await transaction.one(
          `SELECT id FROM practice_session_questions
           WHERE session_id = ? AND selected_option_id IS NULL AND position > ?
           ORDER BY position LIMIT 1`,
          [sessionId, sessionQuestion.position],
        )
        if (nextQuestion) {
          await transaction.execute(
            `UPDATE practice_session_questions SET started_at = ?
             WHERE id = ? AND started_at IS NULL`,
            [answeredAt, nextQuestion.id],
          )
        }
      })
      const revealAnswer = sessionType === 'practice'
      const result = {
        sessionId,
        questionId: input.questionId,
        selectedOptionId: option.id,
        answerDurationMs: isAnswerChange
          ? Number(sessionQuestion.answer_duration_ms)
          : answerDurationMs,
        answeredCount: Number(session.answered_count) + (isAnswerChange ? 0 : 1),
      }
      if (!revealAnswer) return result
      const question = await loadPracticeQuestion(db, input.questionId, { includeAnswer: true })
      return {
        ...result,
        isCorrect,
        correctOptionId: question.correctOptionId,
        explanation: question.explanation,
        correctCount: Number(session.correct_count) + (isCorrect ? 1 : 0),
      }
    },
    async complete(sessionId, studentId) {
      const session = await db.one(
        `SELECT * FROM practice_sessions WHERE id = ? AND student_id = ?`,
        [sessionId, studentId],
      )
      if (!session) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phiên luyện tập.')
      if (session.status === 'completed') return this.get(sessionId, studentId)
      if (Number(session.answered_count) < Number(session.question_count)) {
        throw new ApiError(400, 'VALIDATION', 'Cần trả lời hết câu hỏi trước khi hoàn thành.')
      }
      const completedAt = nowIso()
      await db.execute(
        `UPDATE practice_sessions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
        [completedAt, completedAt, sessionId],
      )
      await audit(db, studentId, 'practice_session.completed', 'practice_session', sessionId, {
        questionCount: session.question_count,
        correctCount: session.correct_count,
      })
      return this.get(sessionId, studentId)
    },
    async getStats(studentId, filters = {}) {
      const params = [studentId]
      const predicates = [
        'practice_sessions.student_id = ?',
        'practice_session_questions.selected_option_id IS NOT NULL',
      ]
      if (filters.subjectId) {
        predicates.push('practice_sessions.subject_id = ?')
        params.push(filters.subjectId)
      }
      if (filters.chapterId) {
        predicates.push('practice_sessions.chapter_id = ?')
        params.push(filters.chapterId)
      }
      const rows = await db.many(
        `SELECT practice_sessions.subject_id, practice_sessions.chapter_id,
                practice_session_questions.question_id,
                practice_session_questions.is_correct,
                practice_session_questions.answer_duration_ms
         FROM practice_session_questions
         JOIN practice_sessions ON practice_sessions.id = practice_session_questions.session_id
         WHERE ${predicates.join(' AND ')}`,
        params,
      )
      const answered = rows.length
      const correct = rows.filter((row) => Number(row.is_correct) === 1).length
      const durations = rows
        .map((row) => Number(row.answer_duration_ms))
        .filter((value) => Number.isFinite(value) && value >= 0)
      const byTopic = new Map()
      for (const row of rows) {
        const key = row.chapter_id ?? 'all'
        const item = byTopic.get(key) ?? { chapterId: row.chapter_id, answered: 0, correct: 0 }
        item.answered += 1
        item.correct += Number(row.is_correct) === 1 ? 1 : 0
        byTopic.set(key, item)
      }
      return {
        answered,
        correct,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
        averageAnswerDurationMs: durations.length
          ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
          : null,
        weakTopics: [...byTopic.values()]
          .filter((item) => item.answered >= 5 && item.correct / item.answered < 0.6)
          .map((item) => ({
            chapterId: item.chapterId,
            answered: item.answered,
            accuracy: Math.round((item.correct / item.answered) * 100),
          })),
      }
    },
    async getOverview(studentId) {
      const currentSession = await db.one(
        `SELECT id FROM practice_sessions
         WHERE student_id = ? AND status = 'in_progress'
         ORDER BY updated_at DESC LIMIT 1`,
        [studentId],
      )
      const subjects = await db.many(
        `SELECT subjects.id, subjects.name,
                COUNT(practice_session_questions.id) AS answered_count,
                SUM(CASE WHEN practice_session_questions.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
         FROM practice_sessions
         JOIN subjects ON subjects.id = practice_sessions.subject_id
         LEFT JOIN practice_session_questions
           ON practice_session_questions.session_id = practice_sessions.id
          AND practice_session_questions.selected_option_id IS NOT NULL
         WHERE practice_sessions.student_id = ?
         GROUP BY subjects.id, subjects.name
         ORDER BY subjects.name`,
        [studentId],
      )
      const stats = await this.getStats(studentId)
      return {
        currentSessionId: currentSession?.id ?? null,
        summary: stats,
        subjects: subjects.map((row) => ({
          id: row.id,
          name: row.name,
          answered: Number(row.answered_count ?? 0),
          correct: Number(row.correct_count ?? 0),
          accuracy: Number(row.answered_count)
            ? Math.round((Number(row.correct_count ?? 0) / Number(row.answered_count)) * 100)
            : 0,
        })),
        recentSessions: await this.listHistory(studentId),
      }
    },
    async listHistory(studentId) {
      return (
        await db.many(
          `SELECT
             practice_sessions.*,
             subjects.name AS subject_name,
             chapters.title AS chapter_title
           FROM practice_sessions
           JOIN subjects ON subjects.id = practice_sessions.subject_id
           LEFT JOIN chapters ON chapters.id = practice_sessions.chapter_id
           WHERE practice_sessions.student_id = ?
           ORDER BY practice_sessions.updated_at DESC
           LIMIT 30`,
          [studentId],
        )
      ).map((row) => ({
        id: row.id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        classId: row.class_id,
        mode: row.mode ?? 'standard',
        sessionType: row.session_type ?? 'practice',
        sourceSessionId: row.source_session_id,
        status: row.status,
        questionCount: Number(row.question_count),
        answeredCount: Number(row.answered_count),
        correctCount:
          row.session_type === 'mock_exam' && row.status !== 'completed'
            ? null
            : Number(row.correct_count),
        accuracy:
          row.session_type === 'mock_exam' && row.status !== 'completed'
            ? null
            : row.question_count
              ? Math.round((row.correct_count / row.question_count) * 100)
              : 0,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
      }))
    },
  }
  const practiceAnalyticsRepository = {
    async getForLecturer(lecturerId, filters = {}) {
      let classIds
      if (filters.classId) {
        const owned = await getOwnedClass(db, filters.classId, lecturerId)
        classIds = [owned.id]
      } else {
        classIds = (
          await db.many(
            `SELECT course_classes.id
             FROM class_lecturer_assignments
             JOIN course_classes ON course_classes.id = class_lecturer_assignments.class_id
             WHERE class_lecturer_assignments.lecturer_id = ?
               AND class_lecturer_assignments.status = 'active'`,
            [lecturerId],
          )
        ).map((row) => row.id)
      }
      if (classIds.length === 0) {
        return {
          summary: {
            studentCount: 0,
            activeStudentCount: 0,
            attemptCount: 0,
            completedCount: 0,
            accuracy: 0,
          },
          byChapter: [],
          questions: [],
        }
      }
      const placeholders = classIds.map(() => '?').join(', ')
      const params = [...classIds]
      const predicates = [`practice_sessions.class_id IN (${placeholders})`]
      if (filters.subjectId) {
        predicates.push('practice_sessions.subject_id = ?')
        params.push(filters.subjectId)
      }
      const sessions = await db.many(
        `SELECT practice_sessions.id, practice_sessions.student_id, practice_sessions.status,
                practice_sessions.subject_id, practice_sessions.chapter_id,
                subjects.name AS subject_name
         FROM practice_sessions
         JOIN subjects ON subjects.id = practice_sessions.subject_id
         WHERE ${predicates.join(' AND ')}`,
        params,
      )
      const sessionIds = sessions.map((row) => row.id)
      let answers = []
      if (sessionIds.length) {
        const answerPlaceholders = sessionIds.map(() => '?').join(', ')
        answers = await db.many(
          `SELECT practice_sessions.student_id,
                  practice_session_questions.question_id,
                  practice_session_questions.is_correct,
                  practice_sessions.chapter_id,
                  chapters.title AS chapter_title,
                  practice_questions.content,
                  practice_questions.difficulty
           FROM practice_session_questions
           JOIN practice_sessions ON practice_sessions.id = practice_session_questions.session_id
           JOIN practice_questions ON practice_questions.id = practice_session_questions.question_id
           LEFT JOIN chapters ON chapters.id = practice_sessions.chapter_id
           WHERE practice_session_questions.session_id IN (${answerPlaceholders})
             AND practice_session_questions.selected_option_id IS NOT NULL`,
          sessionIds,
        )
      }
      const correct = answers.filter((row) => Number(row.is_correct) === 1).length
      const byChapterMap = new Map()
      const questionMap = new Map()
      for (const answer of answers) {
        const chapter = byChapterMap.get(answer.chapter_id) ?? {
          chapterId: answer.chapter_id,
          chapterTitle: answer.chapter_title,
          answered: 0,
          correct: 0,
        }
        chapter.answered += 1
        chapter.correct += Number(answer.is_correct) === 1 ? 1 : 0
        byChapterMap.set(answer.chapter_id, chapter)
        const question = questionMap.get(answer.question_id) ?? {
          questionId: answer.question_id,
          content: answer.content,
          difficulty: answer.difficulty,
          attempts: 0,
          correct: 0,
        }
        question.attempts += 1
        question.correct += Number(answer.is_correct) === 1 ? 1 : 0
        questionMap.set(answer.question_id, question)
      }
      return {
        scope: { classIds, classId: filters.classId ?? null, subjectId: filters.subjectId ?? null },
        summary: {
          studentCount: new Set(sessions.map((row) => row.student_id)).size,
          activeStudentCount: new Set(answers.map((row) => row.student_id)).size,
          attemptCount: sessions.length,
          completedCount: sessions.filter((row) => row.status === 'completed').length,
          answeredCount: answers.length,
          accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
        },
        byChapter: [...byChapterMap.values()].map((item) => ({
          ...item,
          accuracy: item.answered ? Math.round((item.correct / item.answered) * 100) : 0,
        })),
        questions: [...questionMap.values()]
          .map((item) => ({
            ...item,
            accuracy: item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0,
          }))
          .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts),
      }
    },
  }

  const ragRepository = {
    async createDemoChat(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
      }
      await ensureStudentSubjectAccess(db, studentId, input.subjectId)
      const source = await db.one(
        `SELECT
             materials.id AS material_id,
             materials.title,
             materials.author,
             material_versions.id AS version_id,
             material_versions.year,
             rag_citations.quote AS sample_quote,
             rag_citations.page_number AS sample_page_number
           FROM materials
           JOIN approved_sources
             ON approved_sources.material_id = materials.id
            AND approved_sources.is_approved = 1
           JOIN material_versions
             ON material_versions.id = (
               SELECT latest_version.id
               FROM material_versions AS latest_version
               WHERE latest_version.material_id = materials.id
               ORDER BY latest_version.year DESC
               LIMIT 1
             )
           LEFT JOIN rag_citations
             ON rag_citations.id = (
               SELECT sample_citation.id
               FROM rag_citations AS sample_citation
               WHERE sample_citation.material_version_id = material_versions.id
               ORDER BY sample_citation.citation_order
               LIMIT 1
             )
           WHERE materials.subject_id = ?
           ORDER BY materials.title
           LIMIT 1`,
        [input.subjectId],
      )
      if (!source) {
        throw new ApiError(
          409,
          'NO_APPROVED_SOURCE',
          'Môn học này chưa có nguồn được phê duyệt cho trợ giảng.',
        )
      }
      const template = subjectMockResponses.find((item) => item.subjectId === input.subjectId)
      const answerContent = buildDemoChatContent(
        content,
        template?.content ??
          'Trợ giảng chưa có nội dung demo phù hợp cho môn học này. Câu hỏi đã được ghi nhận để giảng viên xem xét.',
      )
      const timestamp = nowIso()
      const questionId = createId('question')
      const requestId = createId('rag_request')
      const responseId = createId('rag_response')
      const citationId = createId('rag_citation')
      const citationQuote =
        source.sample_quote ??
        'Trích đoạn minh họa đang chờ pipeline retrieval trích xuất từ học liệu đã phê duyệt.'
      const moderation = classifyDemoModeration({
        question: content,
        subjectId: input.subjectId,
        hasPageCitation: Boolean(source.sample_page_number),
      })
      const classOptions = await getStudentClassOptions(db, studentId, input.subjectId)
      const courseClass = input.classId
        ? classOptions.find((item) => item.id === input.classId)
        : classOptions.length === 1
          ? classOptions[0]
          : null
      if (input.classId && !courseClass) {
        throw new ApiError(403, 'FORBIDDEN', 'Lớp tín chỉ không thuộc tài khoản sinh viên.')
      }
      if (!input.classId && classOptions.length > 1) {
        throw new ApiError(400, 'VALIDATION', 'Vui lòng chọn lớp tín chỉ cần gửi câu hỏi.')
      }
      const activeLecturers = courseClass
        ? await db.one(
            `SELECT COUNT(*) AS count
             FROM class_lecturer_assignments
             WHERE class_id = ? AND status = 'active'`,
            [courseClass.id],
          )
        : { count: 0 }
      const routingStatus = courseClass && Number(activeLecturers.count) > 0 ? 'queued' : 'unrouted'
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `INSERT INTO questions
           (id, lesson_id, subject_id, student_id, class_id, routing_status,
            content, status, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
          [
            questionId,
            input.subjectId,
            studentId,
            courseClass?.id ?? null,
            routingStatus,
            content,
            timestamp,
            timestamp,
          ],
        )
        await transaction.execute(
          `INSERT INTO rag_requests
           (id, question_id, student_id, subject_id, lesson_id, status, attempt_count,
            request_json, started_at, completed_at, created_at)
           VALUES (?, ?, ?, ?, NULL, 'succeeded', 1, ?, ?, ?, ?)`,
          [
            requestId,
            questionId,
            studentId,
            input.subjectId,
            JSON.stringify({
              demo: true,
              questionId,
              question: content,
              subjectId: input.subjectId,
              moderation,
            }),
            timestamp,
            timestamp,
            timestamp,
          ],
        )
        await transaction.execute(
          `INSERT INTO rag_responses
           (id, request_id, provider_answer_id, content, original_content, confidence,
            review_status, model_version, raw_response_json, reviewed_by, reviewed_at,
            created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, 0.5, 'pending_review', 'demo-chat-api-v1', ?, NULL, NULL, ?, ?)`,
          [
            responseId,
            requestId,
            answerContent,
            answerContent,
            JSON.stringify({
              demo: true,
              source: 'chat-api',
            }),
            timestamp,
            timestamp,
          ],
        )
        await transaction.execute(
          `INSERT INTO rag_citations
           (id, response_id, material_id, material_version_id, page_number, quote,
            citation_order, retrieval_score)
           VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
          [
            citationId,
            responseId,
            source.material_id,
            source.version_id,
            source.sample_page_number ?? null,
            citationQuote,
          ],
        )
        await audit(transaction, studentId, 'rag.chat_created', 'question', questionId, {
          requestId,
          responseId,
          subjectId: input.subjectId,
          classId: courseClass?.id ?? null,
          routingStatus,
        })
      })
      return {
        questionId,
        requestId,
        responseId,
        content: answerContent,
        reviewStatus: 'pending_review',
        isDemo: true,
        moderation,
        citations: [
          {
            id: citationId,
            title: source.title,
            author: source.author,
            location: source.sample_page_number
              ? `Trang ${source.sample_page_number} · phiên bản ${source.year}`
              : `Phiên bản ${source.year}`,
            pageNumber: source.sample_page_number ?? null,
            quote: citationQuote,
          },
        ],
      }
    },
    async listForReview(lecturerId, status = 'pending_review', priority = 'attention') {
      const allowedStatuses = ['pending_review', 'approved', 'rejected', 'needs_revision', 'all']
      const effectiveStatus = allowedStatuses.includes(status) ? status : 'pending_review'
      const allowedPriorities = ['attention', 'high', 'medium', 'sample', 'all']
      const effectivePriority = allowedPriorities.includes(priority) ? priority : 'attention'
      return (await questionRepository.listForLecturer(lecturerId)).filter(
        (question) =>
          question.ragResponse &&
          (effectiveStatus === 'all' || question.ragResponse.reviewStatus === effectiveStatus) &&
          (effectivePriority === 'all' ||
            (effectivePriority === 'attention'
              ? question.ragResponse.moderation.queue === 'attention'
              : question.ragResponse.moderation.priority === effectivePriority)),
      )
    },
    async review(responseId, input, lecturerId) {
      const actionMap = {
        approve: 'approved',
        reject: 'rejected',
        needs_revision: 'needs_revision',
      }
      const reviewStatus = actionMap[input.action]
      if (!reviewStatus) {
        throw new ApiError(400, 'VALIDATION', 'Hành động kiểm duyệt RAG không hợp lệ.')
      }
      const row = await db.one(
        `SELECT rag_responses.*, rag_requests.question_id
           FROM rag_responses
           JOIN rag_requests ON rag_requests.id = rag_responses.request_id
           WHERE rag_responses.id = ?`,
        [responseId],
      )
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu trả lời RAG.')
      await questionRepository.getForLecturer(row.question_id, lecturerId)
      const content = String(input.content ?? row.content).trim()
      if (reviewStatus === 'approved' && content.length < 20) {
        throw new ApiError(400, 'VALIDATION', 'Câu trả lời được duyệt cần ít nhất 20 ký tự.')
      }
      const note = String(input.note ?? '').trim() || null
      const timestamp = nowIso()
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `UPDATE rag_responses
           SET content = ?, review_status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
           WHERE id = ?`,
          [content, reviewStatus, lecturerId, timestamp, timestamp, responseId],
        )
        await transaction.execute(
          `INSERT INTO rag_reviews
           (id, response_id, lecturer_id, action, content, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            createId('rag_review'),
            responseId,
            lecturerId,
            reviewStatus,
            reviewStatus === 'approved' ? content : null,
            note,
            timestamp,
          ],
        )
        const hasLecturerAnswer = await db.one(
          'SELECT id FROM lecturer_answers WHERE question_id = ?',
          [row.question_id],
        )
        const questionStatus =
          reviewStatus === 'approved' || hasLecturerAnswer ? 'answered' : 'unanswered'
        await transaction.execute('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?', [
          questionStatus,
          timestamp,
          row.question_id,
        ])
      })
      await audit(db, lecturerId, `rag.${reviewStatus}`, 'question', row.question_id, {
        responseId,
        note,
        contentEdited: content !== row.content,
      })
      return await questionRepository.getForLecturer(row.question_id, lecturerId)
    },
  }
  const learningRepository = {
    async getDashboard(studentId) {
      const subjectIds = await getStudentSubjectIds(db, studentId)
      const progressMap = await getProgressMap(db, studentId)
      const lessons = []
      for (const subjectId of subjectIds) {
        const subjectLessons = await getSubjectLessons(db, subjectId)
        lessons.push(...subjectLessons.map((lesson) => enrichLessonProgress(lesson, progressMap)))
      }
      const recentCandidates = lessons.filter(
        (lesson) => lesson.lastReadAt && lesson.progress < 100,
      )
      const recentLesson =
        (recentCandidates.length
          ? recentCandidates
          : lessons.filter((lesson) => lesson.lastReadAt)
        ).sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt))[0] ?? null
      return {
        totalLessons: lessons.length,
        completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
        overallProgress: lessons.length
          ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.progress, 0) / lessons.length)
          : 0,
        recentLesson,
      }
    },
    async listSubjectProgress(studentId) {
      const subjectIds = await getStudentSubjectIds(db, studentId)
      const progressMap = await getProgressMap(db, studentId)
      const subjectRows = (await db.many('SELECT * FROM subjects ORDER BY name', [])).filter(
        (subject) => subjectIds.includes(subject.id),
      )
      const result = []
      for (const subject of subjectRows) {
        const lessons = (await getSubjectLessons(db, subject.id)).map((lesson) =>
          enrichLessonProgress(lesson, progressMap),
        )
        result.push({
          id: subject.id,
          name: subject.name,
          credits: subject.credits,
          lessonCount: lessons.length,
          completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
          progress: lessons.length
            ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.progress, 0) / lessons.length)
            : 0,
        })
      }
      return result
    },
    async getSubjectOverview(studentId, subjectId) {
      await ensureStudentSubjectAccess(db, studentId, subjectId)
      const subject = await db.one('SELECT * FROM subjects WHERE id = ?', [subjectId])
      if (!subject) return null
      const progressMap = await getProgressMap(db, studentId)
      const lessons = (await getSubjectLessons(db, subjectId)).map((lesson) =>
        enrichLessonProgress(lesson, progressMap),
      )
      const chapterRows = await db.many(
        `SELECT id, subject_id, chapter_order, title
           FROM chapters
           WHERE subject_id = ?
           ORDER BY chapter_order`,
        [subjectId],
      )
      return {
        subject: {
          id: subject.id,
          name: subject.name,
          credits: subject.credits,
        },
        chapters: chapterRows.map((chapter) => ({
          id: chapter.id,
          subjectId: chapter.subject_id,
          order: chapter.chapter_order,
          title: chapter.title,
          lessons: lessons.filter((lesson) => lesson.chapterId === chapter.id),
        })),
        progress: lessons.length
          ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.progress, 0) / lessons.length)
          : 0,
        completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
        lessonCount: lessons.length,
      }
    },
    async getChapterLessons(studentId, chapterId) {
      const chapter = await db.one('SELECT * FROM chapters WHERE id = ?', [chapterId])
      if (!chapter) return []
      await ensureStudentSubjectAccess(db, studentId, chapter.subject_id)
      const progressMap = await getProgressMap(db, studentId)
      return (await getSubjectLessons(db, chapter.subject_id))
        .filter((lesson) => lesson.chapterId === chapterId)
        .map((lesson) => enrichLessonProgress(lesson, progressMap))
    },
    async getLessonForStudent(studentId, lessonId) {
      const lessonRow = await db.one(
        `SELECT
             lessons.*,
             chapters.subject_id,
             chapters.chapter_order,
             chapters.title AS chapter_title,
             subjects.name AS subject_name,
             subjects.credits AS subject_credits
           FROM lessons
           JOIN chapters ON chapters.id = lessons.chapter_id
           JOIN subjects ON subjects.id = chapters.subject_id
           WHERE lessons.id = ?`,
        [lessonId],
      )
      if (!lessonRow) return null
      await ensureStudentSubjectAccess(db, studentId, lessonRow.subject_id)
      const lessons = await getSubjectLessons(db, lessonRow.subject_id)
      const index = lessons.findIndex((item) => item.id === lessonId)
      const progressMap = await getProgressMap(db, studentId)
      return {
        ...enrichLessonProgress(lessons[index], progressMap),
        subject: {
          id: lessonRow.subject_id,
          name: lessonRow.subject_name,
          credits: lessonRow.subject_credits,
        },
        previousLesson: index > 0 ? lessons[index - 1] : null,
        nextLesson: index < lessons.length - 1 ? lessons[index + 1] : null,
      }
    },
    async updateProgress(studentId, lessonId, progress) {
      const numericProgress = Number(progress)
      if (!Number.isInteger(numericProgress) || numericProgress < 0 || numericProgress > 100) {
        throw new ApiError(400, 'VALIDATION', 'Tiến độ bài học không hợp lệ.')
      }
      const lesson = await this.getLessonForStudent(studentId, lessonId)
      if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
      const existing = await db.one(
        `SELECT * FROM learning_progress
           WHERE student_id = ? AND lesson_id = ?`,
        [studentId, lessonId],
      )
      const id = existing?.id ?? createId('progress')
      const timestamp = nowIso()
      await db.execute(
        `INSERT INTO learning_progress
         (id, student_id, lesson_id, progress, last_read_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(student_id, lesson_id)
         DO UPDATE SET progress = excluded.progress, last_read_at = excluded.last_read_at`,
        [id, studentId, lessonId, numericProgress, timestamp],
      )
      await audit(db, studentId, 'learning_progress.updated', 'lesson', lessonId, {
        before: existing?.progress ?? 0,
        after: numericProgress,
      })
      return {
        id,
        studentId,
        lessonId,
        progress: numericProgress,
        lastReadAt: timestamp,
      }
    },
  }
  const searchRepository = {
    async search(input, studentId) {
      const query = String(input.query ?? '').trim()
      if (!query) return []
      const allowedSubjectIds = await getStudentSubjectIds(db, studentId)
      let effectiveSubjectId = input.subjectId ?? null
      if (input.lessonId) {
        const lesson = await db.one(
          `SELECT chapters.subject_id
             FROM lessons
             JOIN chapters ON chapters.id = lessons.chapter_id
             WHERE lessons.id = ?`,
          [input.lessonId],
        )
        if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
        if (effectiveSubjectId && effectiveSubjectId !== lesson.subject_id) {
          throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn đã chọn.')
        }
        effectiveSubjectId = lesson.subject_id
      }
      if (effectiveSubjectId && !allowedSubjectIds.includes(effectiveSubjectId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
      }
      const lessonRows = (
        await db.many(
          `SELECT
             lessons.*,
             chapters.subject_id,
             chapters.title AS chapter_title,
             chapters.chapter_order,
             subjects.name AS subject_name,
             subjects.credits AS subject_credits
           FROM lessons
           JOIN chapters ON chapters.id = lessons.chapter_id
           JOIN subjects ON subjects.id = chapters.subject_id`,
          [],
        )
      )
        .filter((row) => allowedSubjectIds.includes(row.subject_id))
        .filter((row) => !effectiveSubjectId || row.subject_id === effectiveSubjectId)
        .filter((row) => !input.lessonId || row.id === input.lessonId)
        .filter(
          (row) =>
            includesNormalized(row.title, query) || includesNormalized(row.content_html, query),
        )
        .map((row) => ({
          id: `lesson-${row.id}`,
          title: row.title,
          excerpt: getExcerpt(row.content_html),
          lessonId: row.id,
          sourceType: 'lesson',
          sourceLabel: `${row.chapter_title} · Nội dung môn học`,
          subject: {
            id: row.subject_id,
            name: row.subject_name,
            credits: row.subject_credits,
          },
          chapter: {
            id: row.chapter_id,
            subjectId: row.subject_id,
            order: row.chapter_order,
            title: row.chapter_title,
          },
        }))
      const materialRows = input.lessonId
        ? []
        : (
            await db.many(
              `SELECT
                 materials.*,
                 subjects.name AS subject_name,
                 subjects.credits AS subject_credits,
                 material_versions.year AS version_year
               FROM materials
               JOIN subjects ON subjects.id = materials.subject_id
               JOIN approved_sources
                 ON approved_sources.material_id = materials.id
                AND approved_sources.is_approved = 1
               LEFT JOIN material_versions
                 ON material_versions.id = (
                   SELECT id FROM material_versions AS latest_version
                   WHERE latest_version.material_id = materials.id
                   ORDER BY latest_version.year DESC
                   LIMIT 1
                 )`,
              [],
            )
          )
            .filter((row) => allowedSubjectIds.includes(row.subject_id))
            .filter((row) => !effectiveSubjectId || row.subject_id === effectiveSubjectId)
            .filter(
              (row) =>
                includesNormalized(row.title, query) || includesNormalized(row.author, query),
            )
            .map((row) => ({
              id: `material-${row.id}`,
              title: row.title,
              excerpt: `Tác giả: ${row.author}. Học liệu đã được phê duyệt để sử dụng trong hệ thống.`,
              materialId: row.id,
              sourceType: 'material',
              sourceLabel: `${row.author}${row.version_year ? ` · Bản ${row.version_year}` : ''}`,
              subject: {
                id: row.subject_id,
                name: row.subject_name,
                credits: row.subject_credits,
              },
            }))
      const answerRows = (await getQuestionRows(db))
        .filter((question) => question.lecturerAnswer)
        .filter((question) => allowedSubjectIds.includes(question.subjectId))
        .filter((question) => !effectiveSubjectId || question.subjectId === effectiveSubjectId)
        .filter((question) => !input.lessonId || question.lessonId === input.lessonId)
        .filter(
          (question) =>
            includesNormalized(question.content, query) ||
            includesNormalized(question.lecturerAnswer.content, query),
        )
        .map((question) => ({
          id: `answer-${question.lecturerAnswer.id}`,
          title: question.content,
          excerpt: getExcerpt(question.lecturerAnswer.content),
          questionId: question.id,
          lessonId: question.lessonId,
          sourceType: 'answer',
          sourceLabel: 'Câu trả lời đã xác nhận của giảng viên',
          subject: question.subject,
          chapter: question.chapter,
        }))
      const results = [...lessonRows, ...materialRows, ...answerRows].slice(0, 12)
      if (input.recordHistory !== false) {
        const id = createId('search')
        await db.execute(
          `INSERT INTO search_history
           (id, student_id, query, subject_id, lesson_id, result_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            studentId,
            query,
            effectiveSubjectId,
            input.lessonId ?? null,
            results.length,
            nowIso(),
          ],
        )
        await audit(db, studentId, 'search.created', 'search_history', id, {
          query,
          resultCount: results.length,
        })
      }
      return results
    },
    async listHistory(studentId) {
      return (
        await db.many(
          `SELECT
             search_history.*,
             subjects.name AS subject_name,
             subjects.credits AS subject_credits,
             lessons.title AS lesson_title
           FROM search_history
           LEFT JOIN subjects ON subjects.id = search_history.subject_id
           LEFT JOIN lessons ON lessons.id = search_history.lesson_id
           WHERE search_history.student_id = ?
           ORDER BY search_history.created_at DESC`,
          [studentId],
        )
      ).map((row) => ({
        id: row.id,
        studentId: row.student_id,
        query: row.query,
        subjectId: row.subject_id,
        lessonId: row.lesson_id,
        resultCount: row.result_count,
        createdAt: row.created_at,
        subject: row.subject_id
          ? {
              id: row.subject_id,
              name: row.subject_name,
              credits: row.subject_credits,
            }
          : null,
        lesson: row.lesson_id
          ? {
              id: row.lesson_id,
              title: row.lesson_title,
            }
          : null,
      }))
    },
  }
  const auditRepository = {
    async listForLecturer(lecturerId, limit = 50) {
      return (
        await db.many(
          `SELECT
             audit_logs.*,
             users.name AS actor_name,
             users.email AS actor_email,
             users.role AS actor_role
           FROM audit_logs
           LEFT JOIN users ON users.id = audit_logs.actor_id
           WHERE audit_logs.actor_id = ?
              OR (
                audit_logs.entity_type = 'question'
                AND EXISTS (
                  SELECT 1
                  FROM questions
                  JOIN course_classes ON course_classes.id = questions.class_id
                  JOIN class_lecturer_assignments
                    ON class_lecturer_assignments.class_id = course_classes.id
                  WHERE questions.id = audit_logs.entity_id
                    AND class_lecturer_assignments.lecturer_id = ?
                    AND class_lecturer_assignments.status = 'active'
                )
              )
           ORDER BY audit_logs.created_at DESC
           LIMIT ?`,
          [lecturerId, lecturerId, Math.min(Math.max(Number(limit) || 50, 1), 100)],
        )
      ).map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: parseMetadata(row.metadata_json),
        createdAt: row.created_at,
        actor: row.actor_id
          ? {
              id: row.actor_id,
              name: row.actor_name,
              email: row.actor_email,
              role: row.actor_role,
            }
          : null,
      }))
    },
  }
  return {
    audit,
    auditRepository,
    classContentRepository,
    classRepository,
    learningRepository,
    practiceAnalyticsRepository,
    practiceQuestionRepository,
    practiceSessionRepository,
    questionRepository,
    ragRepository,
    searchRepository,
  }
}
