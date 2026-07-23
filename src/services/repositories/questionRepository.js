import { lecturerAnswers, studentQuestions } from '../../data/mock-questions'
import {
  initialQuestionMockResponses,
  subjectMockResponses,
} from '../../data/mock-student-learning'
import { aiResponses, citations } from '../../data/mock-sources'
import { clone, createRepositoryError, includesNormalized } from '../mock/helpers'
import { resolveQuestionContext } from '../mock/relations'

let runtimeQuestions = clone(studentQuestions)
let runtimeAnswers = clone(lecturerAnswers)
let runtimeMockResponses = clone(initialQuestionMockResponses)
let runtimeAiResponses = clone(aiResponses)

function enrichQuestion(question) {
  const lecturerAnswer = runtimeAnswers.find((answer) => answer.questionId === question.id) ?? null
  const mockResponse =
    runtimeMockResponses.find((answer) => answer.questionId === question.id) ?? null
  const aiResponse = runtimeAiResponses.find((answer) => answer.questionId === question.id)
  const context = resolveQuestionContext(question)

  return {
    ...question,
    ...context,
    lecturerAnswer,
    mockResponse,
    aiResponse: aiResponse
      ? {
          ...aiResponse,
          citations: citations.filter((citation) => citation.aiResponseId === aiResponse.id),
        }
      : null,
    ragRequest: aiResponse
      ? {
          id: `mock-request-${aiResponse.id}`,
          questionId: question.id,
          status: 'succeeded',
          attemptCount: 1,
        }
      : null,
    ragResponse: aiResponse
      ? {
          id: aiResponse.id,
          requestId: `mock-request-${aiResponse.id}`,
          content: aiResponse.content,
          modelVersion: 'demo-ui-v1',
          isDemo: true,
          reviewStatus: aiResponse.status === 'generated' ? 'pending_review' : aiResponse.status,
          createdAt: aiResponse.createdAt,
          reviewedBy: aiResponse.lecturerId ?? null,
          citations: citations.filter((citation) => citation.aiResponseId === aiResponse.id),
        }
      : null,
  }
}

function filterQuestions(filters = {}) {
  const { classId, lecturerId, query, status, studentIds, subjectId } = filters

  return runtimeQuestions
    .map(enrichQuestion)
    .filter((question) => {
      if (lecturerId && question.courseClass?.lecturerId !== lecturerId) return false
      if (classId && question.courseClass?.id !== classId) return false
      if (subjectId && question.subject?.id !== subjectId) return false
      if (status && status !== 'all' && question.status !== status) return false
      if (studentIds?.length && !studentIds.includes(question.studentId)) return false
      if (
        query &&
        !includesNormalized(question.content, query) &&
        !includesNormalized(question.student?.name, query)
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export const questionRepository = {
  async listForStudent(studentId) {
    return clone(filterQuestions({ studentIds: [studentId] }))
  },

  async listForLecturer(lecturerId, filters = {}) {
    return clone(filterQuestions({ ...filters, lecturerId }))
  },

  async listAll(filters = {}) {
    return clone(filterQuestions(filters))
  },

  async getById(questionId) {
    const question = runtimeQuestions.find((item) => item.id === questionId)
    return question ? clone(enrichQuestion(question)) : null
  },

  async getForLecturer(questionId, lecturerId) {
    const question = runtimeQuestions.find((item) => item.id === questionId)
    if (!question) return null
    const enriched = enrichQuestion(question)
    if (enriched.courseClass?.lecturerId !== lecturerId) {
      throw createRepositoryError('FORBIDDEN', 'Bạn không có quyền xử lý câu hỏi này.')
    }
    return clone(enriched)
  },

  async getForStudent(questionId, studentId) {
    const question = runtimeQuestions.find((item) => item.id === questionId)
    if (!question) return null
    if (question.studentId !== studentId) {
      throw createRepositoryError('FORBIDDEN', 'Bạn không có quyền xem câu hỏi này.')
    }
    return clone(enrichQuestion(question))
  },

  async create(input) {
    const content = input.content.trim()
    if (content.length < 10) {
      throw createRepositoryError('VALIDATION', 'Câu hỏi cần có ít nhất 10 ký tự.')
    }

    const question = {
      id: `sq${runtimeQuestions.length + 1}`,
      lessonId: input.lessonId ?? null,
      subjectId: input.subjectId,
      studentId: input.studentId,
      content,
      status: 'unanswered',
      createdAt: new Date().toISOString(),
    }
    const context = resolveQuestionContext(question)
    if (!context.subject || !context.courseClass) {
      throw createRepositoryError('FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
    }
    if (input.lessonId && !context.lesson) {
      throw createRepositoryError('NOT_FOUND', 'Không tìm thấy bài học đã chọn.')
    }
    if (input.lessonId && context.chapter?.subjectId !== input.subjectId) {
      throw createRepositoryError('VALIDATION', 'Bài học không thuộc môn đã chọn.')
    }

    runtimeQuestions = [question, ...runtimeQuestions]
    const responseTemplate = subjectMockResponses.find(
      (item) => item.subjectId === context.subject.id,
    )
    if (responseTemplate) {
      runtimeMockResponses = [
        {
          id: `mr${runtimeMockResponses.length + 1}`,
          questionId: question.id,
          ...responseTemplate,
          createdAt: new Date().toISOString(),
        },
        ...runtimeMockResponses,
      ]
    }
    return clone(enrichQuestion(question))
  },

  async listRagReviews(_lecturerId, status = 'pending_review') {
    return clone(
      filterQuestions().filter(
        (question) =>
          question.ragResponse &&
          (status === 'all' || question.ragResponse.reviewStatus === status),
      ),
    )
  },

  async reviewRagResponse(responseId, input) {
    const response = runtimeAiResponses.find((item) => item.id === responseId)
    if (!response) throw createRepositoryError('NOT_FOUND', 'Không tìm thấy câu trả lời RAG.')
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      needs_revision: 'needs_revision',
    }
    const reviewStatus = statusMap[input.action]
    if (!reviewStatus)
      throw createRepositoryError('VALIDATION', 'Hành động kiểm duyệt không hợp lệ.')
    runtimeAiResponses = runtimeAiResponses.map((item) =>
      item.id === responseId
        ? {
            ...item,
            content: input.content?.trim() || item.content,
            status: reviewStatus,
            lecturerId: input.lecturerId,
          }
        : item,
    )
    if (reviewStatus === 'approved') {
      runtimeQuestions = runtimeQuestions.map((item) =>
        item.id === response.questionId ? { ...item, status: 'answered' } : item,
      )
    }
    return clone(enrichQuestion(runtimeQuestions.find((item) => item.id === response.questionId)))
  },
  async answer(questionId, input) {
    const content = input.content.trim()
    if (!content) throw createRepositoryError('VALIDATION', 'Câu trả lời không được để trống.')

    const question = runtimeQuestions.find((item) => item.id === questionId)
    if (!question) throw createRepositoryError('NOT_FOUND', 'Không tìm thấy câu hỏi.')
    const context = resolveQuestionContext(question)
    if (context.courseClass?.lecturerId !== input.lecturerId) {
      throw createRepositoryError('FORBIDDEN', 'Bạn không có quyền xử lý câu hỏi này.')
    }

    const existing = runtimeAnswers.find((answer) => answer.questionId === questionId)
    let answer
    if (existing) {
      answer = { ...existing, content, updatedAt: new Date().toISOString() }
      runtimeAnswers = runtimeAnswers.map((item) => (item.id === existing.id ? answer : item))
    } else {
      answer = {
        id: `la${runtimeAnswers.length + 1}`,
        questionId,
        lecturerId: input.lecturerId,
        content,
        createdAt: new Date().toISOString(),
      }
      runtimeAnswers = [answer, ...runtimeAnswers]
    }

    runtimeQuestions = runtimeQuestions.map((item) =>
      item.id === questionId ? { ...item, status: 'answered' } : item,
    )

    return clone(answer)
  },

  reset() {
    runtimeQuestions = clone(studentQuestions)
    runtimeAnswers = clone(lecturerAnswers)
    runtimeMockResponses = clone(initialQuestionMockResponses)
    runtimeAiResponses = clone(aiResponses)
  },
}
