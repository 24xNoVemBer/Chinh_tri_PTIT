import { apiRequest, jsonBody, withQuery } from './client'

export const apiAdminRepository = {
  listUsers(filters = {}) {
    return apiRequest(withQuery('/api/admin/users', filters))
  },
  updateUser(userId, input) {
    return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: jsonBody(input),
    })
  },
  listSubjects(filters = {}) {
    return apiRequest(withQuery('/api/admin/subjects', filters))
  },
  createSubject(input) {
    return apiRequest('/api/admin/subjects', { method: 'POST', body: jsonBody(input) })
  },
  updateSubject(subjectId, input) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'PATCH',
      body: jsonBody(input),
    })
  },
  archiveSubject(subjectId) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'DELETE',
    })
  },
  listTerms() {
    return apiRequest('/api/admin/terms')
  },
  createTerm(input) {
    return apiRequest('/api/admin/terms', { method: 'POST', body: jsonBody(input) })
  },
  updateTerm(termId, input) {
    return apiRequest(`/api/admin/terms/${encodeURIComponent(termId)}`, {
      method: 'PATCH',
      body: jsonBody(input),
    })
  },
  listClasses(filters = {}) {
    return apiRequest(withQuery('/api/admin/classes', filters))
  },
  createClass(input) {
    return apiRequest('/api/admin/classes', { method: 'POST', body: jsonBody(input) })
  },
  updateClass(classId, input) {
    return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}`, {
      method: 'PATCH',
      body: jsonBody(input),
    })
  },
  listClassLecturers(classId) {
    return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}/lecturers`)
  },
  assignLecturer(classId, input) {
    return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}/lecturers`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  endLecturerAssignment(classId, lecturerId) {
    return apiRequest(
      `/api/admin/classes/${encodeURIComponent(classId)}/lecturers/${encodeURIComponent(lecturerId)}`,
      { method: 'DELETE' },
    )
  },
  listChapters(subjectId) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}/chapters`)
  },
  createChapter(subjectId, input) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}/chapters`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  listLessons(chapterId) {
    return apiRequest(`/api/admin/chapters/${encodeURIComponent(chapterId)}/lessons`)
  },
  createLesson(chapterId, input) {
    return apiRequest(`/api/admin/chapters/${encodeURIComponent(chapterId)}/lessons`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  listMaterials(subjectId) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}/materials`)
  },
  createMaterial(subjectId, input) {
    return apiRequest(`/api/admin/subjects/${encodeURIComponent(subjectId)}/materials`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  listSharedQuestions(filters = {}) {
    return apiRequest(withQuery('/api/admin/practice-questions', filters))
  },
  createSharedQuestion(input) {
    return apiRequest('/api/admin/practice-questions', {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  listUnroutedQuestions() {
    return apiRequest('/api/admin/questions/unrouted')
  },
  listRoutedQuestions(filters = {}) {
    return apiRequest(withQuery('/api/admin/questions/routed', filters))
  },
  routeQuestion(questionId, classId) {
    return apiRequest(`/api/admin/questions/unrouted/${encodeURIComponent(questionId)}/route`, {
      method: 'POST',
      body: jsonBody({ classId }),
    })
  },
  reassignQuestion(questionId, lecturerId) {
    return apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}/reassign`, {
      method: 'POST',
      body: jsonBody({ lecturerId }),
    })
  },
  getClassAnalytics(classId) {
    return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}/analytics`)
  },
  listAuditLogs(limit = 100) {
    return apiRequest(withQuery('/api/admin/audit-logs', { limit }))
  },
}

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
  listQueue(classId, filters = {}) {
    return apiRequest(
      withQuery(`/api/lecturer/classes/${encodeURIComponent(classId)}/question-queue`, filters),
    )
  },
  claim(questionId, classId) {
    return apiRequest(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/question-queue/${encodeURIComponent(questionId)}/claim`,
      { method: 'POST' },
    )
  },
  release(questionId, classId) {
    return apiRequest(
      `/api/lecturer/classes/${encodeURIComponent(classId)}/question-queue/${encodeURIComponent(questionId)}/release`,
      { method: 'POST' },
    )
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
  listForClass(classId, filters = {}) {
    return apiRequest(
      withQuery(`/api/lecturer/classes/${encodeURIComponent(classId)}/practice-questions`, filters),
    )
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
  importDrafts(input) {
    return apiRequest('/api/lecturer/practice-questions/import', {
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
  saveDraft(questionId) {
    return apiRequest(`/api/lecturer/practice-questions/${encodeURIComponent(questionId)}/draft`, {
      method: 'POST',
    })
  },
  archive(questionId) {
    return apiRequest(
      `/api/lecturer/practice-questions/${encodeURIComponent(questionId)}/archive`,
      { method: 'POST' },
    )
  },
  restore(questionId) {
    return apiRequest(
      `/api/lecturer/practice-questions/${encodeURIComponent(questionId)}/restore`,
      { method: 'POST' },
    )
  },
  remove(questionId) {
    return apiRequest(`/api/lecturer/practice-questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })
  },
}

export const apiPracticeSessionRepository = {
  getOverview() {
    return apiRequest('/api/student/practice/overview')
  },
  getStats(filters = {}) {
    return apiRequest(withQuery('/api/student/practice/stats', filters))
  },
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
    return apiRequest(`/api/student/practice-sessions/${encodeURIComponent(sessionId)}/answers`, {
      method: 'POST',
      body: jsonBody(input),
    })
  },
  complete(sessionId) {
    return apiRequest(`/api/student/practice-sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
    })
  },
  listHistory() {
    return apiRequest('/api/student/practice-sessions/history')
  },
}

export const apiPracticeAnalyticsRepository = {
  getForLecturer(filters = {}) {
    return apiRequest(withQuery('/api/lecturer/practice-analytics', filters))
  },
  getForClass(classId) {
    return apiRequest(`/api/lecturer/classes/${encodeURIComponent(classId)}/analytics`)
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
