import { randomUUID } from 'node:crypto'
import { ApiError } from '../http.js'
import { writeAudit } from '../db/audit.js'

const nowIso = () => new Date().toISOString()
const createId = (prefix) => `${prefix}_${randomUUID()}`

async function ensureStudentSubjectAccess(db, studentId, subjectId) {
  const row = await db.one(
    `
    SELECT 1
    FROM enrollments
    JOIN course_classes ON course_classes.id = enrollments.class_id
    WHERE enrollments.student_id = ? AND course_classes.subject_id = ?
    LIMIT 1
  `,
    [studentId, subjectId],
  )
  if (!row) throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
}

async function allowedSources(db, subjectId) {
  const rows = await db.many(
    `
    SELECT DISTINCT material_versions.id
    FROM material_versions
    JOIN materials ON materials.id = material_versions.material_id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE materials.subject_id = ?
    ORDER BY material_versions.year DESC
  `,
    [subjectId],
  )
  return rows.map((row) => row.id)
}

async function resolveCitation(db, subjectId, citation) {
  const source = await db.one(
    `
    SELECT materials.id AS material_id, material_versions.id AS version_id
    FROM material_versions
    JOIN materials ON materials.id = material_versions.material_id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE material_versions.id = ? AND materials.subject_id = ?
  `,
    [citation.materialVersionId, subjectId],
  )
  if (!source || source.material_id !== citation.materialId) {
    throw new ApiError(
      502,
      'INVALID_CITATION',
      'RAG trả về nguồn không khớp học liệu được phê duyệt.',
    )
  }
  return source
}

export function createLiveRagRepository({ db, ragClient, questionRepository }) {
  if (!db || !ragClient || !questionRepository)
    throw new Error('createLiveRagRepository requires db, ragClient and questionRepository.')

  return {
    async createChat(input, studentId) {
      const content = String(input.content ?? '').trim()
      if (content.length < 10)
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
      await ensureStudentSubjectAccess(db, studentId, input.subjectId)
      const versions = await allowedSources(db, input.subjectId)
      if (!versions.length)
        throw new ApiError(409, 'SOURCE_NOT_INDEXED', 'Môn học chưa có học liệu được phê duyệt.')

      const questionId = createId('question')
      const dbRequestId = createId('rag_request')
      const requestId = randomUUID()
      const createdAt = nowIso()
      const classRows = await db.many(
        `SELECT class_id AS id
         FROM enrollments
         JOIN course_classes ON course_classes.id = enrollments.class_id
         WHERE student_id = ? AND subject_id = ?`,
        [studentId, input.subjectId],
      )
      const courseClass = input.classId
        ? classRows.find((item) => item.id === input.classId)
        : classRows.length === 1
          ? classRows[0]
          : null
      if (input.classId && !courseClass) {
        throw new ApiError(403, 'FORBIDDEN', 'Lớp tín chỉ không thuộc tài khoản sinh viên.')
      }
      if (!input.classId && classRows.length > 1) {
        throw new ApiError(400, 'VALIDATION', 'Vui lòng chọn lớp tín chỉ cần gửi câu hỏi.')
      }
      const lecturerCount = courseClass
        ? await db.one(
            `SELECT COUNT(*) AS count
             FROM class_lecturer_assignments
             WHERE class_id = ? AND status = 'active'`,
            [courseClass.id],
          )
        : { count: 0 }
      const routingStatus = courseClass && Number(lecturerCount.count) > 0 ? 'queued' : 'unrouted'
      const request = {
        schemaVersion: '1.0',
        requestId,
        tenantId: 'ptit',
        query: { text: content, language: input.language ?? 'vi-VN' },
        conversation: {
          conversationId: String(input.conversationId ?? `${studentId}:${input.subjectId}`),
          messageId: String(input.messageId ?? requestId),
          history: Array.isArray(input.history) ? input.history : [],
        },
        scope: {
          subjectId: input.subjectId,
          classIds: classRows.map((row) => row.id),
          lessonId: input.lessonId ?? 'subject-overview',
          allowedMaterialVersionIds: versions,
        },
        policy: {
          publicationMode: 'provisional',
          citationRequired: true,
          maxOutputTokens: 800,
          safetyPolicyVersion: 'ptit-safety-1',
        },
        limits: { deadlineMs: 30_000, maxRetrievedChunks: 8, maxContextTokens: 6_000 },
        client: { name: 'ptit-backend', version: '1.0.0' },
      }
      const idempotencyKey = String(
        input.idempotencyKey ??
          `${studentId}:${request.conversation.conversationId}:${request.conversation.messageId}`,
      )

      await db.transaction(async (transaction) => {
        await transaction.execute(
          `INSERT INTO questions
           (id, lesson_id, subject_id, student_id, class_id, routing_status,
            content, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
          [
            questionId,
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
        await transaction.execute(
          `INSERT INTO rag_requests
           (id, question_id, student_id, subject_id, lesson_id, status, attempt_count,
            request_json, started_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'processing', 1, ?, ?, ?)`,
          [
            dbRequestId,
            questionId,
            studentId,
            input.subjectId,
            input.lessonId ?? null,
            JSON.stringify(request),
            createdAt,
            createdAt,
          ],
        )
      })

      let answer
      try {
        answer = await ragClient.generateAnswer(request, { idempotencyKey, requestId })
      } catch (error) {
        await db.execute(
          `UPDATE rag_requests SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`,
          [error.code ?? 'PROVIDER_UNAVAILABLE', error.message, nowIso(), dbRequestId],
        )
        throw new ApiError(
          Number(error.status) || 502,
          error.code ?? 'PROVIDER_UNAVAILABLE',
          error.message,
          Boolean(error.retryable),
        )
      }

      const citations = []
      for (const [order, citation] of (answer.citations ?? []).entries()) {
        citations.push({
          ...citation,
          order,
          source: await resolveCitation(db, input.subjectId, citation),
        })
      }
      if (answer.outcome === 'answered' && !citations.length)
        throw new ApiError(502, 'INVALID_CITATION', 'Câu trả lời không có citation hợp lệ.')
      const responseId = createId('rag_response')
      const completedAt = nowIso()

      await db.transaction(async (transaction) => {
        await transaction.execute(
          `UPDATE rag_requests SET status = 'succeeded', completed_at = ? WHERE id = ?`,
          [completedAt, dbRequestId],
        )
        await transaction.execute(
          `INSERT INTO rag_responses
           (id, request_id, provider_answer_id, content, original_content, confidence,
            review_status, model_version, raw_response_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?)`,
          [
            responseId,
            dbRequestId,
            answer.providerJobId,
            answer.answer.text,
            answer.answer.text,
            citations[0]?.rerankScore ?? null,
            `${answer.provenance.provider}/${answer.provenance.model}@${answer.provenance.modelRevision}`,
            JSON.stringify(answer),
            completedAt,
            completedAt,
          ],
        )
        for (const citation of citations) {
          await transaction.execute(
            `INSERT INTO rag_citations
             (id, response_id, material_id, material_version_id, page_number, quote,
              citation_order, retrieval_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              createId('rag_citation'),
              responseId,
              citation.source.material_id,
              citation.source.version_id,
              citation.page ?? null,
              citation.quote,
              citation.order,
              citation.retrievalScore ?? null,
            ],
          )
        }
        await writeAudit(transaction, studentId, 'rag.chat_created', 'question', questionId, {
          requestId,
          responseId,
          live: true,
          classId: courseClass?.id ?? null,
          routingStatus,
        })
      })

      const question = await questionRepository.getForStudent(questionId, studentId)
      return {
        questionId: question.id,
        requestId: question.ragRequest.id,
        responseId: question.ragResponse.id,
        content: question.ragResponse.content,
        reviewStatus: question.ragResponse.reviewStatus,
        isDemo: false,
        citations: question.ragResponse.citations.map((citation) => ({
          id: citation.id,
          materialId: citation.materialId,
          materialVersionId: citation.materialVersionId,
          title: citation.material.title,
          author: citation.material.author,
          location: citation.pageNumber ? 'Trang ' + citation.pageNumber : 'Học liệu đã phê duyệt',
          pageNumber: citation.pageNumber,
          quote: citation.quote,
        })),
      }
    },
  }
}
