import { randomUUID } from 'node:crypto'
import { ApiError } from '../http.js'
import { writeAudit } from '../db/audit.js'

const nowIso = () => new Date().toISOString()
const createId = (prefix) => `${prefix}_${randomUUID()}`
const MAX_QUERY_CHARACTERS = 8_000
const STALE_REQUEST_GRACE_MS = 120_000

async function reconcileInterruptedRequests(db) {
  const completedAt = nowIso()
  const staleBefore = new Date(Date.now() - STALE_REQUEST_GRACE_MS).toISOString()
  return db.execute(
    `UPDATE rag_requests
     SET status = 'failed', error_code = 'REQUEST_INTERRUPTED',
         error_message = 'RAG request did not reach a terminal state before its deadline.',
         completed_at = ?
     WHERE status = 'processing' AND started_at IS NOT NULL AND started_at < ?`,
    [completedAt, staleBefore],
  )
}

async function authorizedClasses(db, studentId, subjectId) {
  return db.many(
    `
    SELECT course_classes.id,
           course_classes.academic_term_id,
           academic_terms.code AS academic_term_code
    FROM enrollments
    JOIN course_classes ON course_classes.id = enrollments.class_id
    JOIN academic_terms ON academic_terms.id = course_classes.academic_term_id
    LEFT JOIN enrollment_profiles ON enrollment_profiles.enrollment_id = enrollments.id
    WHERE enrollments.student_id = ?
      AND course_classes.subject_id = ?
      AND course_classes.status = 'active'
      AND academic_terms.status = 'active'
      AND COALESCE(enrollment_profiles.status, 'active') != 'inactive'
    ORDER BY course_classes.id
  `,
    [studentId, subjectId],
  )
}

async function allowedSources(db, subjectId, classId) {
  const rows = await db.many(
    `
    SELECT DISTINCT material_versions.id
    FROM class_materials
    JOIN materials ON materials.id = class_materials.material_id
    JOIN material_versions
      ON material_versions.id = class_materials.version_id
     AND material_versions.material_id = materials.id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE materials.subject_id = ?
      AND class_materials.class_id = ?
      AND class_materials.status = 'published'
    ORDER BY material_versions.year DESC
  `,
    [subjectId, classId],
  )
  return rows.map((row) => row.id)
}

async function resolveCitation(db, subjectId, classId, citation) {
  const source = await db.one(
    `
    SELECT materials.id AS material_id, material_versions.id AS version_id
    FROM class_materials
    JOIN materials ON materials.id = class_materials.material_id
    JOIN material_versions
      ON material_versions.id = class_materials.version_id
     AND material_versions.material_id = materials.id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE material_versions.id = ?
      AND materials.subject_id = ?
      AND class_materials.class_id = ?
      AND class_materials.status = 'published'
  `,
    [citation.materialVersionId, subjectId, classId],
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
      if (content.length > MAX_QUERY_CHARACTERS)
        throw new ApiError(400, 'VALIDATION', 'Câu hỏi không được vượt quá 8.000 ký tự.')
      const classRows = await authorizedClasses(db, studentId, input.subjectId)
      if (!classRows.length)
        throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh hợp lệ vào môn học này.')
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
      if (input.lessonId) {
        const lesson = await db.one(
          `SELECT 1
           FROM class_lessons
           JOIN lessons ON lessons.id = class_lessons.lesson_id
           JOIN chapters ON chapters.id = lessons.chapter_id
           WHERE class_lessons.class_id = ?
             AND class_lessons.lesson_id = ?
             AND class_lessons.status = 'published'
             AND chapters.subject_id = ?`,
          [courseClass.id, input.lessonId, input.subjectId],
        )
        if (!lesson)
          throw new ApiError(403, 'FORBIDDEN', 'Bài học không được xuất bản cho lớp đã chọn.')
      }
      const versions = await allowedSources(db, input.subjectId, courseClass.id)
      if (!versions.length)
        throw new ApiError(
          409,
          'SOURCE_NOT_INDEXED',
          'Lớp học chưa có học liệu được xuất bản và phê duyệt.',
        )

      await reconcileInterruptedRequests(db)

      const questionId = createId('question')
      const dbRequestId = createId('rag_request')
      const requestId = randomUUID()
      const createdAt = nowIso()
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
          // Until the durable conversation ledger in P5 exists, browser-provided
          // history is not trusted or forwarded to the RAG service.
          history: [],
        },
        scope: {
          subjectId: input.subjectId,
          classIds: [courseClass.id],
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

      const markFailed = async (code, message) => {
        try {
          await db.execute(
            `UPDATE rag_requests
             SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?
             WHERE id = ? AND status = 'processing'`,
            [code, message, nowIso(), dbRequestId],
          )
        } catch {
          // Preserve the original error if even failure-state persistence is unavailable.
        }
      }

      let answer
      try {
        answer = await ragClient.generateAnswer(request, { idempotencyKey, requestId })
      } catch (error) {
        await markFailed(error.code ?? 'PROVIDER_UNAVAILABLE', error.message)
        throw new ApiError(
          Number(error.status) || 502,
          error.code ?? 'PROVIDER_UNAVAILABLE',
          error.message,
          Boolean(error.retryable),
        )
      }

      try {
        const citations = []
        for (const [order, citation] of (answer.citations ?? []).entries()) {
          citations.push({
            ...citation,
            order,
            source: await resolveCitation(db, input.subjectId, courseClass.id, citation),
          })
        }
        if (answer.outcome === 'answered' && !citations.length)
          throw new ApiError(502, 'INVALID_CITATION', 'Câu trả lời không có citation hợp lệ.')
        const responseId = createId('rag_response')
        const completedAt = nowIso()

        await db.transaction(async (transaction) => {
          const terminalTransition = await transaction.execute(
            `UPDATE rag_requests
             SET status = 'succeeded', completed_at = ?
             WHERE id = ? AND status = 'processing'`,
            [completedAt, dbRequestId],
          )
          if (Number(terminalTransition?.changes ?? terminalTransition?.rowCount ?? 0) !== 1) {
            throw new ApiError(
              409,
              'REQUEST_STATE_CONFLICT',
              'Yêu cầu RAG không còn ở trạng thái đang xử lý.',
            )
          }
          await transaction.execute(
            `INSERT INTO rag_responses
           (id, request_id, provider_answer_id, content, original_content, confidence,
            review_status, model_version, index_version, raw_response_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?)`,
            [
              responseId,
              dbRequestId,
              answer.providerJobId,
              answer.answer.text,
              answer.answer.text,
              citations[0]?.rerankScore ?? null,
              `${answer.provenance.provider}/${answer.provenance.model}@${answer.provenance.modelRevision}`,
              answer.provenance.indexVersion,
              JSON.stringify(answer),
              completedAt,
              completedAt,
            ],
          )
          for (const citation of citations) {
            await transaction.execute(
              `INSERT INTO rag_citations
             (id, response_id, material_id, material_version_id, page_number,
              chunk_id, chunk_sha256, section, quote, citation_order, retrieval_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                createId('rag_citation'),
                responseId,
                citation.source.material_id,
                citation.source.version_id,
                citation.page ?? null,
                citation.chunkId,
                citation.chunkSha256,
                citation.section ?? null,
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
          answerMode: answer.provenance.provider.endsWith('-extractive') ? 'extractive' : 'model',
          sampleData: ['local-rag-extractive', 'local-rag-openai'].includes(
            answer.provenance.provider,
          ),
          moderation: { requiresReview: answer.review.required },
          citations: question.ragResponse.citations.map((citation) => ({
            id: citation.id,
            materialId: citation.materialId,
            materialVersionId: citation.materialVersionId,
            title: citation.material.title,
            author: citation.material.author,
            location: ['local-rag-extractive', 'local-rag-openai'].includes(
              answer.provenance.provider,
            )
              ? 'Tài liệu mẫu · chưa được thẩm định'
              : answer.provenance.provider.startsWith('local-rag-private-')
                ? `Pilot riêng · ${citation.pageNumber ? `Trang PDF ${citation.pageNumber}` : 'chưa rõ trang'} · chưa thẩm định`
                : citation.pageNumber
                  ? 'Trang ' + citation.pageNumber
                  : 'Học liệu đã phê duyệt',
            pageNumber: citation.pageNumber,
            quote: citation.quote,
          })),
        }
      } catch (error) {
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(500, 'PERSISTENCE_FAILED', 'Không thể lưu kết quả RAG.', true)
        await markFailed(apiError.code, apiError.message)
        throw apiError
      }
    },
  }
}
