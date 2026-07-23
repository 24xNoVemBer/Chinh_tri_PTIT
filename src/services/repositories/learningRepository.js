import { learningProgress } from '../../data/mock-student-learning'
import { chapters, courseClasses, enrollments, subjects } from '../../data/mock-classes'
import { curriculumLessons } from '../../data/mock-lessons'
import { clone, createRepositoryError } from '../mock/helpers'

let runtimeProgress = clone(learningProgress)

function getEnrolledSubjectIds(studentId) {
  const classIds = enrollments
    .filter((item) => item.studentId === studentId)
    .map((item) => item.classId)
  return courseClasses.filter((item) => classIds.includes(item.id)).map((item) => item.subjectId)
}

function getProgress(studentId, lessonId) {
  return (
    runtimeProgress.find((item) => item.studentId === studentId && item.lessonId === lessonId) ??
    null
  )
}

function getSubjectLessons(subjectId) {
  const subjectChapters = chapters
    .filter((item) => item.subjectId === subjectId)
    .sort((a, b) => a.order - b.order)

  return subjectChapters.flatMap((chapter) =>
    curriculumLessons
      .filter((lesson) => lesson.chapterId === chapter.id)
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({ ...lesson, chapter })),
  )
}

function ensureStudentSubjectAccess(studentId, subjectId) {
  if (!getEnrolledSubjectIds(studentId).includes(subjectId)) {
    throw createRepositoryError('FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
  }
}

function enrichLesson(studentId, lesson) {
  const progress = getProgress(studentId, lesson.id)
  return {
    ...lesson,
    progress: progress?.progress ?? 0,
    lastReadAt: progress?.lastReadAt ?? null,
  }
}

export const learningRepository = {
  async getDashboard(studentId) {
    const subjectIds = getEnrolledSubjectIds(studentId)
    const lessons = subjectIds.flatMap((subjectId) =>
      getSubjectLessons(subjectId).map((lesson) => enrichLesson(studentId, lesson)),
    )
    const totalProgress = lessons.reduce((sum, lesson) => sum + lesson.progress, 0)
    const recentCandidates = lessons.filter((lesson) => lesson.lastReadAt && lesson.progress < 100)
    const recentLesson =
      (recentCandidates.length
        ? recentCandidates
        : lessons.filter((lesson) => lesson.lastReadAt)
      ).sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt))[0] ?? null

    return clone({
      totalLessons: lessons.length,
      completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
      overallProgress: lessons.length ? Math.round(totalProgress / lessons.length) : 0,
      recentLesson,
    })
  },

  async listSubjectProgress(studentId) {
    const subjectIds = getEnrolledSubjectIds(studentId)
    return clone(
      subjects
        .filter((subject) => subjectIds.includes(subject.id))
        .map((subject) => {
          const lessons = getSubjectLessons(subject.id).map((lesson) =>
            enrichLesson(studentId, lesson),
          )
          const totalProgress = lessons.reduce((sum, lesson) => sum + lesson.progress, 0)
          return {
            ...subject,
            lessonCount: lessons.length,
            completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
            progress: lessons.length ? Math.round(totalProgress / lessons.length) : 0,
          }
        }),
    )
  },

  async getSubjectOverview(studentId, subjectId) {
    ensureStudentSubjectAccess(studentId, subjectId)
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) return null

    const subjectChapters = chapters
      .filter((item) => item.subjectId === subjectId)
      .sort((a, b) => a.order - b.order)
      .map((chapter) => ({
        ...chapter,
        lessons: curriculumLessons
          .filter((lesson) => lesson.chapterId === chapter.id)
          .sort((a, b) => a.order - b.order)
          .map((lesson) => enrichLesson(studentId, lesson)),
      }))
    const lessons = subjectChapters.flatMap((chapter) => chapter.lessons)
    const totalProgress = lessons.reduce((sum, lesson) => sum + lesson.progress, 0)

    return clone({
      subject,
      chapters: subjectChapters,
      progress: lessons.length ? Math.round(totalProgress / lessons.length) : 0,
      completedLessons: lessons.filter((lesson) => lesson.progress === 100).length,
      lessonCount: lessons.length,
    })
  },

  async getLessonForStudent(studentId, lessonId) {
    const lesson = curriculumLessons.find((item) => item.id === lessonId)
    if (!lesson) return null
    const chapter = chapters.find((item) => item.id === lesson.chapterId)
    const subject = subjects.find((item) => item.id === chapter?.subjectId)
    ensureStudentSubjectAccess(studentId, subject?.id)

    const subjectLessons = getSubjectLessons(subject.id)
    const index = subjectLessons.findIndex((item) => item.id === lessonId)
    return clone({
      ...enrichLesson(studentId, { ...lesson, chapter }),
      subject,
      previousLesson: index > 0 ? subjectLessons[index - 1] : null,
      nextLesson: index < subjectLessons.length - 1 ? subjectLessons[index + 1] : null,
    })
  },

  async updateProgress(studentId, lessonId, progress) {
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw createRepositoryError('VALIDATION', 'Tiến độ bài học không hợp lệ.')
    }
    const lesson = await this.getLessonForStudent(studentId, lessonId)
    if (!lesson) throw createRepositoryError('NOT_FOUND', 'Không tìm thấy bài học.')

    const nextProgress = {
      id: getProgress(studentId, lessonId)?.id ?? `lp${runtimeProgress.length + 1}`,
      studentId,
      lessonId,
      progress,
      lastReadAt: new Date().toISOString(),
    }
    const existing = getProgress(studentId, lessonId)
    runtimeProgress = existing
      ? runtimeProgress.map((item) => (item.id === existing.id ? nextProgress : item))
      : [...runtimeProgress, nextProgress]
    return clone(nextProgress)
  },

  reset() {
    runtimeProgress = clone(learningProgress)
  },
}
