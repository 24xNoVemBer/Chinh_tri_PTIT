import { chapters, enrollments, courseClasses, subjects } from '../../data/mock-classes'
import { classLessons, curriculumLessons } from '../../data/mock-lessons'
import { clone } from '../mock/helpers'

export const subjectRepository = {
  async listForStudent(studentId) {
    const classIds = enrollments
      .filter((item) => item.studentId === studentId)
      .map((item) => item.classId)
    const subjectIds = courseClasses
      .filter((item) => classIds.includes(item.id))
      .map((item) => item.subjectId)

    return clone(subjects.filter((subject) => subjectIds.includes(subject.id)))
  },

  async getById(subjectId) {
    const subject = subjects.find((item) => item.id === subjectId)
    return subject ? clone(subject) : null
  },

  async listChapters(subjectId) {
    return clone(chapters.filter((chapter) => chapter.subjectId === subjectId))
  },

  async listLessons(chapterId) {
    return clone(curriculumLessons.filter((lesson) => lesson.chapterId === chapterId))
  },

  async getLessonById(lessonId) {
    const lesson = curriculumLessons.find((item) => item.id === lessonId)
    return lesson ? clone(lesson) : null
  },

  async listScheduledLessons(classId) {
    const scheduled = classLessons.filter((item) => item.classId === classId)
    return clone(
      scheduled.map((item) => ({
        ...item,
        lesson: curriculumLessons.find((lesson) => lesson.id === item.lessonId),
      })),
    )
  },
}
