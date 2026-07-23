import { enrollmentProfiles } from '../../data/mock-class-management'
import { courseClasses, enrollments, subjects } from '../../data/mock-classes'
import { studentQuestions } from '../../data/mock-questions'
import { students } from '../../data/mock-users'
import { clone, createRepositoryError, includesNormalized } from '../mock/helpers'
import { resolveQuestionContext } from '../mock/relations'

let runtimeEnrollmentProfiles = clone(enrollmentProfiles)

function getCourseClass(classId) {
  return courseClasses.find((item) => item.id === classId) ?? null
}

function ensureLecturerAccess(courseClass, lecturerId) {
  if (lecturerId && courseClass?.lecturerId !== lecturerId) {
    throw createRepositoryError('FORBIDDEN', 'Bạn không có quyền quản lý lớp học này.')
  }
}

function getClassQuestions(classId) {
  return studentQuestions.filter(
    (question) => resolveQuestionContext(question).courseClass?.id === classId,
  )
}

function enrichClass(courseClass) {
  const subject = subjects.find((item) => item.id === courseClass.subjectId)
  const studentCount = enrollments.filter((item) => item.classId === courseClass.id).length
  const questions = getClassQuestions(courseClass.id)

  return {
    ...courseClass,
    subject,
    studentCount,
    questionCount: questions.length,
    unansweredCount: questions.filter((item) => item.status === 'unanswered').length,
  }
}

function enrichEnrollment(enrollment) {
  const student = students.find((item) => item.id === enrollment.studentId)
  const profile = runtimeEnrollmentProfiles.find((item) => item.enrollmentId === enrollment.id)
  return {
    ...student,
    enrollmentId: enrollment.id,
    classId: enrollment.classId,
    status: profile?.status ?? 'active',
    progress: profile?.progress ?? 0,
    lastActiveAt: profile?.lastActiveAt ?? null,
  }
}

export const classRepository = {
  async listForLecturer(lecturerId) {
    return clone(courseClasses.filter((item) => item.lecturerId === lecturerId).map(enrichClass))
  },

  async getById(classId, options = {}) {
    const courseClass = getCourseClass(classId)
    if (!courseClass) return null
    ensureLecturerAccess(courseClass, options.lecturerId)
    return clone(enrichClass(courseClass))
  },

  async listStudents(classId, filters = {}) {
    const { lecturerId, query, status } = filters
    const courseClass = getCourseClass(classId)
    if (!courseClass) return []
    ensureLecturerAccess(courseClass, lecturerId)

    return clone(
      enrollments
        .filter((item) => item.classId === classId)
        .map(enrichEnrollment)
        .filter((student) => {
          if (status && status !== 'all' && student.status !== status) return false
          if (
            query &&
            !includesNormalized(student.name, query) &&
            !includesNormalized(student.email, query)
          ) {
            return false
          }
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    )
  },

  async updateStudentStatus(classId, studentId, status, options = {}) {
    if (!['active', 'attention', 'inactive'].includes(status)) {
      throw createRepositoryError('VALIDATION', 'Trạng thái sinh viên không hợp lệ.')
    }
    const courseClass = getCourseClass(classId)
    if (!courseClass) return null
    ensureLecturerAccess(courseClass, options.lecturerId)

    const enrollment = enrollments.find(
      (item) => item.classId === classId && item.studentId === studentId,
    )
    if (!enrollment) return null

    runtimeEnrollmentProfiles = runtimeEnrollmentProfiles.map((item) =>
      item.enrollmentId === enrollment.id ? { ...item, status } : item,
    )
    return clone(enrichEnrollment(enrollment))
  },

  async getMetrics(classId, options = {}) {
    const classStudents = await this.listStudents(classId, options)
    if (!classStudents.length) {
      return { averageProgress: 0, attentionCount: 0, inactiveCount: 0 }
    }
    const averageProgress = Math.round(
      classStudents.reduce((sum, student) => sum + student.progress, 0) / classStudents.length,
    )
    return {
      averageProgress,
      attentionCount: classStudents.filter((item) => item.status === 'attention').length,
      inactiveCount: classStudents.filter((item) => item.status === 'inactive').length,
    }
  },

  reset() {
    runtimeEnrollmentProfiles = clone(enrollmentProfiles)
  },
}
