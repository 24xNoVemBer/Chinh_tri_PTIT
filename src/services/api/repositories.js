import { apiRequest, jsonBody, withQuery } from './client'

export const apiClassRepository = {
  listForLecturer() {
    return apiRequest('/api/lecturer/classes')
  },
  getById(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}`)
  },
  listStudents(classId, filters = {}) {
    return apiRequest(
      withQuery(`/api/lecturer/classes/${encodeURIComponent(classId)}/students`, filters),
    )
  },
  updateStudentStatus(classId, studentId, status) {
    return apiRequest(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
      { method: 'PATCH', body: jsonBody({ status }) },
    )
  },
  getMetrics(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/metrics`)
  },
}

export const apiClassContentRepository = {
  listLessons(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/lessons`)
  },
  listAvailableLessons(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/lessons/available`)
  },
  scheduleLesson(classId, input) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/lessons`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  updateLessonStatus(classId, scheduledLessonId, status) {
    return apiRequest(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/lessons/${encodeURIComponent(scheduledLessonId)}`,
      { method: 'PATCH', body: jsonBody({ status }) },
    )
  },
  listMaterials(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/materials`)
  },
  listAvailableMaterials(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/materials/available`)
  },
  attachMaterial(classId, input) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/materials`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  updateMaterialStatus(classId, classMaterialId, status) {
    return apiRequest(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/materials/${encodeURIComponent(classMaterialId)}`,
      { method: 'PATCH', body: jsonBody({ status }) },
    )
  },
  addMaterialVersion(materialId, input) {
    return apiRequest(`/api/lecturer/materials/${encodeURIComponent(materialId)}/versions`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
}

export const apiQuestionRepository = {
  listForStudent() {
    return apiRequest('/api/student/questions')
  },
  listForLecturer(_lecturerId, filters = {}) {
    return apiRequest(withQuery('/api/lecturer/questions', filters))
  },
  getForLecturer(questionId) {
    return apiRequest(`/api/lecturer/questions/${encodeURIComponent(questionId)}`)
  },
  getForStudent(questionId) {
    return apiRequest(`/api/student/questions/${encodeURIComponent(questionId)}`)
  },
  create(input) {
    return apiRequest('/api/student/questions', {
      method: 'POST',
      body: jsonBody({
        content: input.content,
        lessonId: input.lessonId,
        subjectId: input.subjectId,
      }),
    })
  },
  answer(questionId, input) {
    return apiRequest(`/api/lecturer/questions/${encodeURIComponent(questionId)}/answer`, {
      method: 'POST',
      body: jsonBody({ content: input.content }),
    })
  },
  listRagReviews(_lecturerId, status = 'pending_review', priority = 'attention') {
    return apiRequest(withQuery('/api/lecturer/rag/reviews', { priority, status }))
  },
  reviewRagResponse(responseId, input) {
    return apiRequest(`/api/lecturer/rag/responses/${encodeURIComponent(responseId)}/review`, {
      method: 'POST',
      body: jsonBody({
        action: input.action,
        content: input.content,
        note: input.note,
      }),
    })
  },
}

export const apiPracticeQuestionRepository = {
  listForLecturer(filters = {}) {
    return apiRequest(withQuery('/api/lecturer/practice-questions', filters))
  },
  getForLecturer(questionId) {
    return apiRequest(`/api/lecturer/practice-questions/${encodeURIComponent(questionId)}`)
  },
  create(input) {
    return apiRequest('/api/lecturer/practice-questions', {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  update(questionId, input) {
    return apiRequest(`/api/lecturer/practice-questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      body: jsonBody(input),
    })
  },
  publish(questionId) {
    return apiRequest(
      `/api/lecturer/practice-questions/${encodeURIComponent(questionId)}/publish`,
      { method: 'POST' },
    )
  },
  archive(questionId) {
    return apiRequest(
      `/api/lecturer/practice-questions/${encodeURIComponent(questionId)}/archive`,
      { method: 'POST' },
    )
  },
}

export const apiPracticeSessionRepository = {
  getConfig(subjectId) {
    return apiRequest(`/api/student/practice/config/${encodeURIComponent(subjectId)}`)
  },
  create(input) {
    return apiRequest('/api/student/practice-sessions', {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  get(sessionId) {
    return apiRequest(`/api/student/practice-sessions/${encodeURIComponent(sessionId)}`)
  },
  answer(sessionId, input) {
    return apiRequest(
      `/api/student/practice-sessions/${encodeURIComponent(sessionId)}/answers`,
      { method: 'POST', body: jsonBody(input) },
    )
  },
  complete(sessionId) {
    return apiRequest(
      `/api/student/practice-sessions/${encodeURIComponent(sessionId)}/complete`,
      { method: 'POST' },
    )
  },
  listHistory() {
    return apiRequest('/api/student/practice-sessions/history')
  },
}

export const apiLearningRepository = {
  getDashboard() {
    return apiRequest('/api/student/dashboard')
  },
  listSubjectProgress() {
    return apiRequest('/api/student/subjects')
  },
  getSubjectOverview(_studentId, subjectId) {
    return apiRequest(`/api/student/subjects/${encodeURIComponent(subjectId)}`)
  },
  getLessonForStudent(_studentId, lessonId) {
    return apiRequest(`/api/student/lessons/${encodeURIComponent(lessonId)}`)
  },
  updateProgress(_studentId, lessonId, progress) {
    return apiRequest(`/api/student/lessons/${encodeURIComponent(lessonId)}/progress`, {
      method: 'PATCH',
      body: jsonBody({ progress }),
    })
  },
}

export const apiSubjectRepository = {
  async listForStudent() {
    return apiRequest('/api/student/subjects')
  },
  async listChapters(subjectId) {
    const overview = await apiRequest(`/api/student/subjects/${encodeURIComponent(subjectId)}`)
    return overview?.chapters ?? []
  },
  listLessons(chapterId) {
    return apiRequest(`/api/student/chapters/${encodeURIComponent(chapterId)}/lessons`)
  },
}

export const apiSearchRepository = {
  search(input) {
    return apiRequest('/api/student/search', {
      method: 'POST',
      body: jsonBody({
        lessonId: input.lessonId,
        query: input.query,
        recordHistory: input.recordHistory,
        subjectId: input.subjectId,
      }),
    })
  },
  listHistory() {
    return apiRequest('/api/student/search-history')
  },
}

export const apiAuditRepository = {
  listForLecturer(limit = 50) {
    return apiRequest(withQuery('/api/lecturer/audit-logs', { limit }))
  },
}

export const apiChatRepository = {
  createMessage(input) {
    return apiRequest('/api/student/chat', {
      method: 'POST',
      body: jsonBody({
        content: input.content,
        subjectId: input.subjectId,
      }),
    })
  },
}
