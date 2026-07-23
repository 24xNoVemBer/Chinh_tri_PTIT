import { chapters, courseClasses, enrollments, subjects } from '../../data/mock-classes'
import { curriculumLessons } from '../../data/mock-lessons'
import { students } from '../../data/mock-users'

export function resolveQuestionContext(question) {
  const student = students.find((item) => item.id === question.studentId) ?? null
  const lesson = curriculumLessons.find((item) => item.id === question.lessonId) ?? null
  const chapter = chapters.find((item) => item.id === lesson?.chapterId) ?? null
  const subject =
    subjects.find((item) => item.id === (question.subjectId ?? chapter?.subjectId)) ?? null
  const enrolledClassIds = enrollments
    .filter((item) => item.studentId === question.studentId)
    .map((item) => item.classId)
  const courseClass =
    courseClasses.find(
      (item) => enrolledClassIds.includes(item.id) && item.subjectId === subject?.id,
    ) ?? null

  return { student, lesson, chapter, subject, courseClass }
}
