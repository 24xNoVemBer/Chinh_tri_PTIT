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

function audit(db, actorId, action, entityType, entityId, metadata = null) {
  db.prepare(
    `INSERT INTO audit_logs
     (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    createId('audit'),
    actorId ?? null,
    action,
    entityType,
    entityId ?? null,
    metadata ? JSON.stringify(metadata) : null,
    nowIso(),
  )
}

function getOwnedClass(db, classId, lecturerId) {
  const row = db
    .prepare(
      `SELECT
         course_classes.*,
         subjects.name AS subject_name,
         subjects.credits AS subject_credits
       FROM course_classes
       JOIN subjects ON subjects.id = course_classes.subject_id
       WHERE course_classes.id = ?`,
    )
    .get(classId)
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy lớp học.')
  const assignment = db
    .prepare(
      `SELECT assignment_role
       FROM class_lecturer_assignments
       WHERE class_id = ? AND lecturer_id = ? AND status = 'active'`,
    )
    .get(classId, lecturerId)
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

function getRagCitations(db, responseId) {
  if (!responseId) return []
  return db
    .prepare(
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
    )
    .all(responseId)
    .map((citation) => ({
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

function mapQuestion(row, db) {
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
          citations: getRagCitations(db, row.rag_response_id),
        }
      : null,
  }
}

function getStudentSubjectIds(db, studentId) {
  return db
    .prepare(
      `SELECT DISTINCT course_classes.subject_id
       FROM enrollments
       JOIN course_classes ON course_classes.id = enrollments.class_id
       WHERE enrollments.student_id = ?`,
    )
    .all(studentId)
    .map((row) => row.subject_id)
}

function ensureStudentSubjectAccess(db, studentId, subjectId) {
  if (!getStudentSubjectIds(db, studentId).includes(subjectId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
  }
}

function getStudentClassOptions(db, studentId, subjectId) {
  return db
    .prepare(
      `SELECT course_classes.id, course_classes.subject_id
       FROM enrollments
       JOIN course_classes ON course_classes.id = enrollments.class_id
       WHERE enrollments.student_id = ? AND course_classes.subject_id = ?
       ORDER BY course_classes.semester DESC, course_classes.name`,
    )
    .all(studentId, subjectId)
}

function getSubjectLessons(db, subjectId) {
  return db
    .prepare(
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
    )
    .all(subjectId)
    .map((row) => ({
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

function getProgressMap(db, studentId) {
  return new Map(
    db
      .prepare(
        `SELECT lesson_id, progress, last_read_at
         FROM learning_progress
         WHERE student_id = ?`,
      )
      .all(studentId)
      .map((row) => [row.lesson_id, { progress: row.progress, lastReadAt: row.last_read_at }]),
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

function getQuestionRows(db) {
  return db
    .prepare(`${QUESTION_SELECT} GROUP BY questions.id`)
    .all()
    .map((row) => mapQuestion(row, db))
}

function getQuestionRowsForLecturer(db, lecturerId) {
  return db
    .prepare(
      `${QUESTION_SELECT}
       WHERE EXISTS (
         SELECT 1
         FROM class_lecturer_assignments
         WHERE class_lecturer_assignments.class_id = course_classes.id
           AND class_lecturer_assignments.lecturer_id = ?
           AND class_lecturer_assignments.status = 'active'
       )
       GROUP BY questions.id`,
    )
    .all(lecturerId)
    .map((row) => mapQuestion(row, db))
}

export function createRepositories(db) {
  const classRepository = {
    listForLecturer(lecturerId) {
      return db
        .prepare(
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
        )
        .all(lecturerId)
        .map(mapClass)
    },

    getById(classId, lecturerId) {
      getOwnedClass(db, classId, lecturerId)
      return this.listForLecturer(lecturerId).find((item) => item.id === classId) ?? null
    },

    listStudents(classId, lecturerId, filters = {}) {
      getOwnedClass(db, classId, lecturerId)
      const students = db
        .prepare(
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
        )
        .all(classId)
        .map((row) => ({
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

    updateStudentStatus(classId, studentId, status, lecturerId) {
      if (!['active', 'attention', 'inactive'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái sinh viên không hợp lệ.')
      }
      getOwnedClass(db, classId, lecturerId)
      const enrollment = db
        .prepare(
          `SELECT
             enrollments.id,
             enrollment_profiles.status
           FROM enrollments
           LEFT JOIN enrollment_profiles
             ON enrollment_profiles.enrollment_id = enrollments.id
           WHERE enrollments.class_id = ? AND enrollments.student_id = ?`,
        )
        .get(classId, studentId)
      if (!enrollment) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sinh viên.')

      db.prepare(
        `INSERT INTO enrollment_profiles
         (enrollment_id, status, progress, last_active_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(enrollment_id) DO UPDATE SET status = excluded.status`,
      ).run(enrollment.id, status, nowIso())
      audit(db, lecturerId, 'student.status_updated', 'enrollment', enrollment.id, {
        before: enrollment.status,
        after: status,
        classId,
        studentId,
      })
      return this.listStudents(classId, lecturerId).find((item) => item.id === studentId)
    },

    getMetrics(classId, lecturerId) {
      const students = this.listStudents(classId, lecturerId)
      if (!students.length) {
        return { averageProgress: 0, attentionCount: 0, inactiveCount: 0 }
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
    listLessons(classId, lecturerId) {
      getOwnedClass(db, classId, lecturerId)
      return db
        .prepare(
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
        )
        .all(classId)
        .map(mapScheduledLesson)
    },

    listAvailableLessons(classId, lecturerId) {
      const courseClass = getOwnedClass(db, classId, lecturerId)
      return db
        .prepare(
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
        )
        .all(courseClass.subject_id, classId)
        .map((row) => ({
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

    scheduleLesson(classId, input, lecturerId) {
      const courseClass = getOwnedClass(db, classId, lecturerId)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) {
        throw new ApiError(400, 'VALIDATION', 'Ngày học không hợp lệ.')
      }
      const lesson = db
        .prepare(
          `SELECT lessons.id, chapters.subject_id
           FROM lessons
           JOIN chapters ON chapters.id = lessons.chapter_id
           WHERE lessons.id = ?`,
        )
        .get(input.lessonId)
      if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
      if (lesson.subject_id !== courseClass.subject_id) {
        throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn của lớp này.')
      }

      const id = createId('class_lesson')
      try {
        db.prepare(
          `INSERT INTO class_lessons
           (id, class_id, lesson_id, lesson_date, status, created_by, created_at)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
        ).run(id, classId, input.lessonId, input.date, lecturerId, nowIso())
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Bài học đã có trong lớp.')
        }
        throw error
      }
      audit(db, lecturerId, 'class_lesson.created', 'class_lesson', id, {
        classId,
        lessonId: input.lessonId,
      })
      return this.listLessons(classId, lecturerId).find((item) => item.id === id)
    },

    updateLessonStatus(classId, scheduledLessonId, status, lecturerId) {
      if (!['draft', 'published'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái bài học không hợp lệ.')
      }
      getOwnedClass(db, classId, lecturerId)
      const existing = db
        .prepare('SELECT status FROM class_lessons WHERE id = ? AND class_id = ?')
        .get(scheduledLessonId, classId)
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học trong lớp.')
      db.prepare('UPDATE class_lessons SET status = ? WHERE id = ?').run(status, scheduledLessonId)
      audit(db, lecturerId, 'class_lesson.status_updated', 'class_lesson', scheduledLessonId, {
        before: existing.status,
        after: status,
        classId,
      })
      return this.listLessons(classId, lecturerId).find((item) => item.id === scheduledLessonId)
    },

    listMaterials(classId, lecturerId) {
      getOwnedClass(db, classId, lecturerId)
      return db
        .prepare(
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
        )
        .all(classId)
        .map(mapClassMaterial)
    },

    listAvailableMaterials(classId, lecturerId) {
      const courseClass = getOwnedClass(db, classId, lecturerId)
      return db
        .prepare(
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
        )
        .all(courseClass.subject_id, classId)
        .map((row) => ({
          id: row.id,
          subjectId: row.subject_id,
          title: row.title,
          type: row.type,
          author: row.author,
          versions: db
            .prepare(
              `SELECT id, material_id, year, file_url
               FROM material_versions
               WHERE material_id = ?
               ORDER BY year DESC`,
            )
            .all(row.id)
            .map((version) => ({
              id: version.id,
              materialId: version.material_id,
              year: version.year,
              fileUrl: version.file_url,
            })),
        }))
    },

    attachMaterial(classId, input, lecturerId) {
      const courseClass = getOwnedClass(db, classId, lecturerId)
      const material = db
        .prepare(
          `SELECT materials.*
           FROM materials
           JOIN approved_sources
             ON approved_sources.material_id = materials.id
            AND approved_sources.is_approved = 1
           WHERE materials.id = ?`,
        )
        .get(input.materialId)
      if (!material) {
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy học liệu đã duyệt.')
      }
      if (material.subject_id !== courseClass.subject_id) {
        throw new ApiError(400, 'VALIDATION', 'Học liệu không thuộc môn của lớp này.')
      }
      const version = db
        .prepare(
          `SELECT * FROM material_versions
           WHERE material_id = ?
           ORDER BY year DESC
           LIMIT 1`,
        )
        .get(material.id)
      if (!version) {
        throw new ApiError(404, 'NOT_FOUND', 'Học liệu chưa có phiên bản khả dụng.')
      }

      const id = createId('class_material')
      try {
        db.prepare(
          `INSERT INTO class_materials
           (id, class_id, material_id, version_id, status, added_by, added_at)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
        ).run(id, classId, material.id, version.id, lecturerId, nowIso())
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Học liệu đã được gắn vào lớp.')
        }
        throw error
      }
      audit(db, lecturerId, 'class_material.created', 'class_material', id, {
        classId,
        materialId: material.id,
        versionId: version.id,
      })
      return this.listMaterials(classId, lecturerId).find((item) => item.id === id)
    },

    updateMaterialStatus(classId, classMaterialId, status, lecturerId) {
      if (!['draft', 'published'].includes(status)) {
        throw new ApiError(400, 'VALIDATION', 'Trạng thái học liệu không hợp lệ.')
      }
      getOwnedClass(db, classId, lecturerId)
      const existing = db
        .prepare('SELECT status FROM class_materials WHERE id = ? AND class_id = ?')
        .get(classMaterialId, classId)
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy học liệu trong lớp.')
      db.prepare('UPDATE class_materials SET status = ? WHERE id = ?').run(status, classMaterialId)
      audit(db, lecturerId, 'class_material.status_updated', 'class_material', classMaterialId, {
        before: existing.status,
        after: status,
        classId,
      })
      return this.listMaterials(classId, lecturerId).find((item) => item.id === classMaterialId)
    },

    addMaterialVersion(materialId, input, lecturerId) {
      const material = db
        .prepare(
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
        )
        .get(materialId, lecturerId)
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
        db.prepare(
          `INSERT INTO material_versions
           (id, material_id, year, file_url, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, materialId, year, input.fileUrl.trim(), lecturerId, nowIso())
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new ApiError(409, 'CONFLICT', 'Phiên bản năm này đã tồn tại.')
        }
        throw error
      }
      audit(db, lecturerId, 'material_version.created', 'material_version', id, {
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
    listForLecturer(lecturerId, filters = {}) {
      return getQuestionRowsForLecturer(db, lecturerId)
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

    listForStudent(studentId) {
      return getQuestionRows(db)
        .filter((question) => question.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },

    getForLecturer(questionId, lecturerId) {
      const question = this.listForLecturer(lecturerId).find((item) => item.id === questionId)
      if (!question) {
        const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId)
        if (exists) {
          throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xử lý câu hỏi này.')
        }
        return null
      }
      return question
    },

    getForStudent(questionId, studentId) {
      const question = getQuestionRows(db).find((item) => item.id === questionId)
      if (!question) return null
      if (question.studentId !== studentId) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền xem câu hỏi này.')
      }
      return question
    },

    create(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
      }
      ensureStudentSubjectAccess(db, studentId, input.subjectId)
      if (input.lessonId) {
        const lesson = db
          .prepare(
            `SELECT chapters.subject_id
             FROM lessons
             JOIN chapters ON chapters.id = lessons.chapter_id
             WHERE lessons.id = ?`,
          )
          .get(input.lessonId)
        if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
        if (lesson.subject_id !== input.subjectId) {
          throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn đã chọn.')
        }
      }

      const id = createId('question')
      const createdAt = nowIso()
      const classOptions = getStudentClassOptions(db, studentId, input.subjectId)
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
        ? db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM class_lecturer_assignments
               WHERE class_id = ? AND status = 'active'`,
            )
            .get(courseClass.id)
        : { count: 0 }
      const routingStatus = courseClass && Number(activeLecturers.count) > 0 ? 'queued' : 'unrouted'
      db.prepare(
        `INSERT INTO questions
         (id, lesson_id, subject_id, student_id, class_id, routing_status,
          content, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
      ).run(
        id,
        input.lessonId ?? null,
        input.subjectId,
        studentId,
        courseClass?.id ?? null,
        routingStatus,
        content,
        createdAt,
        createdAt,
      )

      audit(db, studentId, 'question.created', 'question', id, {
        subjectId: input.subjectId,
        lessonId: input.lessonId ?? null,
        classId: courseClass?.id ?? null,
        routingStatus,
      })
      return this.getForStudent(id, studentId)
    },

    answer(questionId, input, lecturerId) {
      const question = this.getForLecturer(questionId, lecturerId)
      if (!question) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu hỏi.')
      const content = String(input.content ?? '').trim()
      if (!content) {
        throw new ApiError(400, 'VALIDATION', 'Câu trả lời không được để trống.')
      }

      const existing = db
        .prepare('SELECT * FROM lecturer_answers WHERE question_id = ?')
        .get(questionId)
      const timestamp = nowIso()
      let answerId
      if (existing) {
        answerId = existing.id
        db.prepare(
          `UPDATE lecturer_answers
           SET content = ?, updated_at = ?
           WHERE id = ?`,
        ).run(content, timestamp, answerId)
      } else {
        answerId = createId('answer')
        db.prepare(
          `INSERT INTO lecturer_answers
           (id, question_id, lecturer_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        ).run(answerId, questionId, lecturerId, content, timestamp)
      }
      db.prepare(
        `UPDATE questions
         SET status = 'answered', updated_at = ?
         WHERE id = ?`,
      ).run(timestamp, questionId)
      audit(
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
      return this.getForLecturer(questionId, lecturerId).lecturerAnswer
    },
  }

  const ragRepository = {
    createDemoChat(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
      }
      ensureStudentSubjectAccess(db, studentId, input.subjectId)

      const source = db
        .prepare(
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
        )
        .get(input.subjectId)
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
      const classOptions = getStudentClassOptions(db, studentId, input.subjectId)
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
        ? db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM class_lecturer_assignments
               WHERE class_id = ? AND status = 'active'`,
            )
            .get(courseClass.id)
        : { count: 0 }
      const routingStatus = courseClass && Number(activeLecturers.count) > 0 ? 'queued' : 'unrouted'

      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          `INSERT INTO questions
           (id, lesson_id, subject_id, student_id, class_id, routing_status,
            content, status, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
        ).run(
          questionId,
          input.subjectId,
          studentId,
          courseClass?.id ?? null,
          routingStatus,
          content,
          timestamp,
          timestamp,
        )
        db.prepare(
          `INSERT INTO rag_requests
           (id, question_id, student_id, subject_id, lesson_id, status, attempt_count,
            request_json, started_at, completed_at, created_at)
           VALUES (?, ?, ?, ?, NULL, 'succeeded', 1, ?, ?, ?, ?)`,
        ).run(
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
        )
        db.prepare(
          `INSERT INTO rag_responses
           (id, request_id, provider_answer_id, content, original_content, confidence,
            review_status, model_version, raw_response_json, reviewed_by, reviewed_at,
            created_at, updated_at)
           VALUES (?, ?, NULL, ?, ?, 0.5, 'pending_review', 'demo-chat-api-v1', ?, NULL, NULL, ?, ?)`,
        ).run(
          responseId,
          requestId,
          answerContent,
          answerContent,
          JSON.stringify({ demo: true, source: 'chat-api' }),
          timestamp,
          timestamp,
        )
        db.prepare(
          `INSERT INTO rag_citations
           (id, response_id, material_id, material_version_id, page_number, quote,
            citation_order, retrieval_score)
           VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
        ).run(
          citationId,
          responseId,
          source.material_id,
          source.version_id,
          source.sample_page_number ?? null,
          citationQuote,
        )
        audit(db, studentId, 'rag.chat_created', 'question', questionId, {
          requestId,
          responseId,
          subjectId: input.subjectId,
        })
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }

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

    listForReview(lecturerId, status = 'pending_review', priority = 'attention') {
      const allowedStatuses = ['pending_review', 'approved', 'rejected', 'needs_revision', 'all']
      const effectiveStatus = allowedStatuses.includes(status) ? status : 'pending_review'
      const allowedPriorities = ['attention', 'high', 'medium', 'sample', 'all']
      const effectivePriority = allowedPriorities.includes(priority) ? priority : 'attention'
      return questionRepository
        .listForLecturer(lecturerId)
        .filter(
          (question) =>
            question.ragResponse &&
            (effectiveStatus === 'all' || question.ragResponse.reviewStatus === effectiveStatus) &&
            (effectivePriority === 'all' ||
              (effectivePriority === 'attention'
                ? question.ragResponse.moderation.queue === 'attention'
                : question.ragResponse.moderation.priority === effectivePriority)),
        )
    },

    review(responseId, input, lecturerId) {
      const actionMap = {
        approve: 'approved',
        reject: 'rejected',
        needs_revision: 'needs_revision',
      }
      const reviewStatus = actionMap[input.action]
      if (!reviewStatus) {
        throw new ApiError(400, 'VALIDATION', 'Hành động kiểm duyệt RAG không hợp lệ.')
      }

      const row = db
        .prepare(
          `SELECT rag_responses.*, rag_requests.question_id
           FROM rag_responses
           JOIN rag_requests ON rag_requests.id = rag_responses.request_id
           WHERE rag_responses.id = ?`,
        )
        .get(responseId)
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy câu trả lời RAG.')
      questionRepository.getForLecturer(row.question_id, lecturerId)

      const content = String(input.content ?? row.content).trim()
      if (reviewStatus === 'approved' && content.length < 20) {
        throw new ApiError(400, 'VALIDATION', 'Câu trả lời được duyệt cần ít nhất 20 ký tự.')
      }
      const note = String(input.note ?? '').trim() || null
      const timestamp = nowIso()

      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          `UPDATE rag_responses
           SET content = ?, review_status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
           WHERE id = ?`,
        ).run(content, reviewStatus, lecturerId, timestamp, timestamp, responseId)
        db.prepare(
          `INSERT INTO rag_reviews
           (id, response_id, lecturer_id, action, content, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          createId('rag_review'),
          responseId,
          lecturerId,
          reviewStatus,
          reviewStatus === 'approved' ? content : null,
          note,
          timestamp,
        )
        const hasLecturerAnswer = db
          .prepare('SELECT id FROM lecturer_answers WHERE question_id = ?')
          .get(row.question_id)
        const questionStatus =
          reviewStatus === 'approved' || hasLecturerAnswer ? 'answered' : 'unanswered'
        db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?').run(
          questionStatus,
          timestamp,
          row.question_id,
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }

      audit(db, lecturerId, `rag.${reviewStatus}`, 'question', row.question_id, {
        responseId,
        note,
        contentEdited: content !== row.content,
      })
      return questionRepository.getForLecturer(row.question_id, lecturerId)
    },
  }
  const learningRepository = {
    getDashboard(studentId) {
      const subjectIds = getStudentSubjectIds(db, studentId)
      const progressMap = getProgressMap(db, studentId)
      const lessons = subjectIds.flatMap((subjectId) =>
        getSubjectLessons(db, subjectId).map((lesson) => enrichLessonProgress(lesson, progressMap)),
      )
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

    listSubjectProgress(studentId) {
      const subjectIds = getStudentSubjectIds(db, studentId)
      const progressMap = getProgressMap(db, studentId)
      return db
        .prepare('SELECT * FROM subjects ORDER BY name')
        .all()
        .filter((subject) => subjectIds.includes(subject.id))
        .map((subject) => {
          const lessons = getSubjectLessons(db, subject.id).map((lesson) =>
            enrichLessonProgress(lesson, progressMap),
          )
          return {
            id: subject.id,
            name: subject.name,
            credits: subject.credits,
            lessonCount: lessons.length,
            completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
            progress: lessons.length
              ? Math.round(
                  lessons.reduce((sum, lesson) => sum + lesson.progress, 0) / lessons.length,
                )
              : 0,
          }
        })
    },

    getSubjectOverview(studentId, subjectId) {
      ensureStudentSubjectAccess(db, studentId, subjectId)
      const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId)
      if (!subject) return null
      const progressMap = getProgressMap(db, studentId)
      const lessons = getSubjectLessons(db, subjectId).map((lesson) =>
        enrichLessonProgress(lesson, progressMap),
      )
      const chapterRows = db
        .prepare(
          `SELECT id, subject_id, chapter_order, title
           FROM chapters
           WHERE subject_id = ?
           ORDER BY chapter_order`,
        )
        .all(subjectId)
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

    getChapterLessons(studentId, chapterId) {
      const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId)
      if (!chapter) return []
      ensureStudentSubjectAccess(db, studentId, chapter.subject_id)
      const progressMap = getProgressMap(db, studentId)
      return getSubjectLessons(db, chapter.subject_id)
        .filter((lesson) => lesson.chapterId === chapterId)
        .map((lesson) => enrichLessonProgress(lesson, progressMap))
    },

    getLessonForStudent(studentId, lessonId) {
      const lessonRow = db
        .prepare(
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
        )
        .get(lessonId)
      if (!lessonRow) return null
      ensureStudentSubjectAccess(db, studentId, lessonRow.subject_id)
      const lessons = getSubjectLessons(db, lessonRow.subject_id)
      const index = lessons.findIndex((item) => item.id === lessonId)
      const progressMap = getProgressMap(db, studentId)
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

    updateProgress(studentId, lessonId, progress) {
      const numericProgress = Number(progress)
      if (!Number.isInteger(numericProgress) || numericProgress < 0 || numericProgress > 100) {
        throw new ApiError(400, 'VALIDATION', 'Tiến độ bài học không hợp lệ.')
      }
      const lesson = this.getLessonForStudent(studentId, lessonId)
      if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
      const existing = db
        .prepare(
          `SELECT * FROM learning_progress
           WHERE student_id = ? AND lesson_id = ?`,
        )
        .get(studentId, lessonId)
      const id = existing?.id ?? createId('progress')
      const timestamp = nowIso()
      db.prepare(
        `INSERT INTO learning_progress
         (id, student_id, lesson_id, progress, last_read_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(student_id, lesson_id)
         DO UPDATE SET progress = excluded.progress, last_read_at = excluded.last_read_at`,
      ).run(id, studentId, lessonId, numericProgress, timestamp)
      audit(db, studentId, 'learning_progress.updated', 'lesson', lessonId, {
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
    search(input, studentId) {
      const query = String(input.query ?? '').trim()
      if (!query) return []
      const allowedSubjectIds = getStudentSubjectIds(db, studentId)
      let effectiveSubjectId = input.subjectId ?? null
      if (input.lessonId) {
        const lesson = db
          .prepare(
            `SELECT chapters.subject_id
             FROM lessons
             JOIN chapters ON chapters.id = lessons.chapter_id
             WHERE lessons.id = ?`,
          )
          .get(input.lessonId)
        if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy bài học.')
        if (effectiveSubjectId && effectiveSubjectId !== lesson.subject_id) {
          throw new ApiError(400, 'VALIDATION', 'Bài học không thuộc môn đã chọn.')
        }
        effectiveSubjectId = lesson.subject_id
      }
      if (effectiveSubjectId && !allowedSubjectIds.includes(effectiveSubjectId)) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
      }

      const lessonRows = db
        .prepare(
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
        )
        .all()
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
        : db
            .prepare(
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
            )
            .all()
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

      const answerRows = getQuestionRows(db)
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
        db.prepare(
          `INSERT INTO search_history
           (id, student_id, query, subject_id, lesson_id, result_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          studentId,
          query,
          effectiveSubjectId,
          input.lessonId ?? null,
          results.length,
          nowIso(),
        )
        audit(db, studentId, 'search.created', 'search_history', id, {
          query,
          resultCount: results.length,
        })
      }
      return results
    },

    listHistory(studentId) {
      return db
        .prepare(
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
        )
        .all(studentId)
        .map((row) => ({
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
    listForLecturer(lecturerId, limit = 50) {
      return db
        .prepare(
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
        )
        .all(lecturerId, lecturerId, Math.min(Math.max(Number(limit) || 50, 1), 100))
        .map((row) => ({
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
    questionRepository,
    ragRepository,
    searchRepository,
  }
}
