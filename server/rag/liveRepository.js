import { randomUUID } from 'node:crypto'
import { ApiError } from '../http.js'

const nowIso = () => new Date().toISOString()
const createId = (prefix) => `${prefix}_${randomUUID()}`

function ensureStudentSubjectAccess(db, studentId, subjectId) {
  const row = db
    .prepare(
      `
    SELECT 1
    FROM enrollments
    JOIN course_classes ON course_classes.id = enrollments.class_id
    WHERE enrollments.student_id = ? AND course_classes.subject_id = ?
    LIMIT 1
  `,
    )
    .get(studentId, subjectId)
  if (!row) throw new ApiError(403, 'FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
}

function allowedSources(db, subjectId) {
  return db
    .prepare(
      `
    SELECT DISTINCT material_versions.id
    FROM material_versions
    JOIN materials ON materials.id = material_versions.material_id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE materials.subject_id = ?
    ORDER BY material_versions.year DESC
  `,
    )
    .all(subjectId)
    .map((row) => row.id)
}

function resolveCitation(db, subjectId, citation) {
  const source = db
    .prepare(
      `
    SELECT materials.id AS material_id, material_versions.id AS version_id
    FROM material_versions
    JOIN materials ON materials.id = material_versions.material_id
    JOIN approved_sources ON approved_sources.material_id = materials.id AND approved_sources.is_approved = 1
    WHERE material_versions.id = ? AND materials.subject_id = ?
  `,
    )
    .get(citation.materialVersionId, subjectId)
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
      ensureStudentSubjectAccess(db, studentId, input.subjectId)
      const versions = allowedSources(db, input.subjectId)
      if (!versions.length)
        throw new ApiError(409, 'SOURCE_NOT_INDEXED', 'Môn học chưa có học liệu được phê duyệt.')

      const questionId = createId('question')
      const dbRequestId = createId('rag_request')
      const requestId = randomUUID()
      const createdAt = nowIso()
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
          classIds: db
            .prepare(
              `SELECT class_id AS id FROM enrollments JOIN course_classes ON course_classes.id = enrollments.class_id WHERE student_id = ? AND subject_id = ?`,
            )
            .all(studentId, input.subjectId)
            .map((row) => row.id),
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

      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          `INSERT INTO questions (id, lesson_id, subject_id, student_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'unanswered', ?, ?)`,
        ).run(
          questionId,
          input.lessonId ?? null,
          input.subjectId,
          studentId,
          content,
          createdAt,
          createdAt,
        )
        db.prepare(
          `INSERT INTO rag_requests (id, question_id, student_id, subject_id, lesson_id, status, attempt_count, request_json, started_at, created_at) VALUES (?, ?, ?, ?, ?, 'processing', 1, ?, ?, ?)`,
        ).run(
          dbRequestId,
          questionId,
          studentId,
          input.subjectId,
          input.lessonId ?? null,
          JSON.stringify(request),
          createdAt,
          createdAt,
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }

      let answer
      try {
        answer = await ragClient.generateAnswer(request, { idempotencyKey, requestId })
      } catch (error) {
        db.prepare(
          `UPDATE rag_requests SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`,
        ).run(error.code ?? 'PROVIDER_UNAVAILABLE', error.message, nowIso(), dbRequestId)
        throw new ApiError(
          Number(error.status) || 502,
          error.code ?? 'PROVIDER_UNAVAILABLE',
          error.message,
          Boolean(error.retryable),
        )
      }

      const citations = (answer.citations ?? []).map((citation, order) => ({
        ...citation,
        order,
        source: resolveCitation(db, input.subjectId, citation),
      }))
      if (answer.outcome === 'answered' && !citations.length)
        throw new ApiError(502, 'INVALID_CITATION', 'Câu trả lời không có citation hợp lệ.')
      const responseId = createId('rag_response')
      const completedAt = nowIso()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          `UPDATE rag_requests SET status = 'succeeded', completed_at = ? WHERE id = ?`,
        ).run(completedAt, dbRequestId)
        db.prepare(
          `INSERT INTO rag_responses (id, request_id, provider_answer_id, content, original_content, confidence, review_status, model_version, raw_response_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?)`,
        ).run(
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
        )
        for (const citation of citations)
          db.prepare(
            `INSERT INTO rag_citations (id, response_id, material_id, material_version_id, page_number, quote, citation_order, retrieval_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            createId('rag_citation'),
            responseId,
            citation.source.material_id,
            citation.source.version_id,
            citation.page ?? null,
            citation.quote,
            citation.order,
            citation.retrievalScore ?? null,
          )
        db.prepare(
          `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          createId('audit'),
          studentId,
          'rag.chat_created',
          'question',
          questionId,
          JSON.stringify({ requestId, responseId, live: true }),
          completedAt,
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      const question = questionRepository.getForStudent(questionId, studentId)
      return {
        questionId: question.id,
        requestId: question.ragRequest.id,
        responseId: question.ragResponse.id,
        content: question.ragResponse.content,
        reviewStatus: question.ragResponse.reviewStatus,
        isDemo: false,
        citations: question.ragResponse.citations.map((citation) => ({
          id: citation.id,
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
