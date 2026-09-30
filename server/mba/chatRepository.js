import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { ApiError } from '../http.js'

const MAX_QUESTION_LENGTH = 8_000

function normalizeSources(sources, sourceId) {
  return sources.slice(0, 5).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || typeof item.text !== 'string') return []
    const quote = item.text.trim().slice(0, 1_200)
    if (!quote) return []
    const fileName = typeof item.file_name === 'string' ? item.file_name : ''
    return [
      {
        id: `mba-source-${index}`,
        sourceId,
        providerNodeId: typeof item.id === 'string' ? item.id.trim() || null : null,
        retrievalScore:
          typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null,
        title: basename(fileName.replaceAll('\\', '/')) || 'Tài liệu MBA_API',
        author: 'Nguồn MBA_API',
        location: 'Đoạn truy xuất · chưa đối chiếu học liệu lớp',
        quote,
      },
    ]
  })
}

export function createMbaChatRepository({ db, client, sourceMap }) {
  if (!db || !client || !sourceMap) throw new Error('MBA chat requires db, client and sourceMap.')

  return {
    async createChat(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10 || content.length > MAX_QUESTION_LENGTH) {
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có từ 10 đến 8.000 ký tự.')
      }
      const subjectId = String(input.subjectId ?? '')
      const source = Object.hasOwn(sourceMap, subjectId) ? sourceMap[subjectId] : null
      if (!source) {
        throw new ApiError(409, 'SOURCE_NOT_MAPPED', 'Học phần chưa được nối với nguồn MBA_API.')
      }
      const classes = await db.many(
        `SELECT course_classes.id, subjects.name AS subject_name
         FROM enrollments
         JOIN course_classes ON course_classes.id = enrollments.class_id
         JOIN subjects ON subjects.id = course_classes.subject_id
         JOIN academic_terms ON academic_terms.id = course_classes.academic_term_id
         LEFT JOIN enrollment_profiles ON enrollment_profiles.enrollment_id = enrollments.id
         WHERE enrollments.student_id = ?
           AND course_classes.subject_id = ?
           AND course_classes.status = 'active'
           AND academic_terms.status = 'active'
           AND COALESCE(enrollment_profiles.status, 'active') != 'inactive'`,
        [studentId, subjectId],
      )
      if (!classes.length) {
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh hợp lệ vào môn học này.')
      }
      const courseClass = input.classId
        ? classes.find((item) => item.id === input.classId)
        : classes.length === 1
          ? classes[0]
          : null
      if (!courseClass) {
        throw new ApiError(
          input.classId ? 403 : 400,
          input.classId ? 'FORBIDDEN' : 'VALIDATION',
          input.classId
            ? 'Lớp tín chỉ không thuộc tài khoản sinh viên.'
            : 'Vui lòng chọn lớp tín chỉ.',
        )
      }

      let answer
      try {
        answer = await client.chat({
          userId: studentId,
          text: content,
          source,
          subjectName: courseClass.subject_name,
        })
      } catch (error) {
        throw new ApiError(
          error.status ?? 502,
          error.code ?? 'PROVIDER_UNAVAILABLE',
          error.message ?? 'MBA_API không khả dụng.',
        )
      }
      return {
        responseId: `mba_${randomUUID()}`,
        content: answer.content,
        answerMode: 'mba',
        reviewStatus: 'unverified',
        moderation: { requiresReview: true },
        isDemo: false,
        citations: [],
        sources: normalizeSources(answer.sources, source),
      }
    },
  }
}
