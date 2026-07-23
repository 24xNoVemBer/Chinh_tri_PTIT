import { chapters, courseClasses, enrollments, subjects } from '../../data/mock-classes'
import { curriculumLessons } from '../../data/mock-lessons'
import { lecturerAnswers, studentQuestions } from '../../data/mock-questions'
import { searchHistory } from '../../data/mock-student-learning'
import { approvedSources, materials, materialVersions } from '../../data/mock-sources'
import { clone, createRepositoryError, includesNormalized } from '../mock/helpers'
import { resolveQuestionContext } from '../mock/relations'

let runtimeSearchHistory = clone(searchHistory)

function getStudentSubjectIds(studentId) {
  const classIds = enrollments
    .filter((item) => item.studentId === studentId)
    .map((item) => item.classId)
  return courseClasses.filter((item) => classIds.includes(item.id)).map((item) => item.subjectId)
}

function getLessonContext(lesson) {
  const chapter = chapters.find((item) => item.id === lesson?.chapterId) ?? null
  const subject = subjects.find((item) => item.id === chapter?.subjectId) ?? null
  return { chapter, subject }
}

function getExcerpt(content, maxLength = 240) {
  const plainText = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plainText.length > maxLength ? `${plainText.slice(0, maxLength).trim()}…` : plainText
}

export const searchRepository = {
  async search({ query, studentId, subjectId, lessonId, recordHistory = true }) {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    const selectedLesson = lessonId
      ? (curriculumLessons.find((item) => item.id === lessonId) ?? null)
      : null
    if (lessonId && !selectedLesson) {
      throw createRepositoryError('NOT_FOUND', 'Không tìm thấy bài học đã chọn.')
    }
    const selectedLessonContext = getLessonContext(selectedLesson)
    if (subjectId && lessonId && selectedLessonContext.subject?.id !== subjectId) {
      throw createRepositoryError('VALIDATION', 'Bài học không thuộc môn đã chọn.')
    }

    const effectiveSubjectId = subjectId ?? selectedLessonContext.subject?.id ?? null
    const allowedSubjectIds = studentId
      ? getStudentSubjectIds(studentId)
      : subjects.map((item) => item.id)
    if (effectiveSubjectId && !allowedSubjectIds.includes(effectiveSubjectId)) {
      throw createRepositoryError('FORBIDDEN', 'Bạn chưa được ghi danh vào môn học này.')
    }

    const lessonResults = curriculumLessons
      .filter((lesson) => {
        const context = getLessonContext(lesson)
        if (!allowedSubjectIds.includes(context.subject?.id)) return false
        if (effectiveSubjectId && context.subject?.id !== effectiveSubjectId) return false
        if (lessonId && lesson.id !== lessonId) return false
        return (
          includesNormalized(lesson.title, trimmedQuery) ||
          includesNormalized(lesson.contentHtml, trimmedQuery)
        )
      })
      .map((lesson) => {
        const context = getLessonContext(lesson)
        return {
          id: `lesson-${lesson.id}`,
          title: lesson.title,
          excerpt: getExcerpt(lesson.contentHtml),
          lessonId: lesson.id,
          sourceType: 'lesson',
          sourceLabel: `${context.chapter?.title ?? 'Bài học'} · Nội dung môn học`,
          subject: context.subject,
          chapter: context.chapter,
        }
      })

    const approvedMaterialIds = approvedSources
      .filter((item) => item.isApproved)
      .map((item) => item.materialId)
    const materialResults = lessonId
      ? []
      : materials
          .filter((material) => {
            if (!allowedSubjectIds.includes(material.subjectId)) return false
            if (!approvedMaterialIds.includes(material.id)) return false
            if (effectiveSubjectId && material.subjectId !== effectiveSubjectId) return false
            return (
              includesNormalized(material.title, trimmedQuery) ||
              includesNormalized(material.author, trimmedQuery)
            )
          })
          .map((material) => {
            const version = materialVersions
              .filter((item) => item.materialId === material.id)
              .sort((a, b) => b.year - a.year)[0]
            return {
              id: `material-${material.id}`,
              title: material.title,
              excerpt: `Tác giả: ${material.author}. Học liệu đã được phê duyệt để sử dụng trong hệ thống.`,
              materialId: material.id,
              sourceType: 'material',
              sourceLabel: `${material.author}${version ? ` · Bản ${version.year}` : ''}`,
              subject: subjects.find((item) => item.id === material.subjectId) ?? null,
            }
          })

    const answerResults = lecturerAnswers
      .map((answer) => {
        const question = studentQuestions.find((item) => item.id === answer.questionId)
        return { answer, question, context: resolveQuestionContext(question ?? {}) }
      })
      .filter(({ answer, question, context }) => {
        if (!question || !allowedSubjectIds.includes(context.subject?.id)) return false
        if (effectiveSubjectId && context.subject?.id !== effectiveSubjectId) return false
        if (lessonId && question.lessonId !== lessonId) return false
        return (
          includesNormalized(answer.content, trimmedQuery) ||
          includesNormalized(question.content, trimmedQuery)
        )
      })
      .map(({ answer, question, context }) => ({
        id: `answer-${answer.id}`,
        title: question.content,
        excerpt: getExcerpt(answer.content),
        questionId: question.id,
        lessonId: question.lessonId,
        sourceType: 'answer',
        sourceLabel: 'Câu trả lời đã xác nhận của giảng viên',
        subject: context.subject,
        chapter: context.chapter,
      }))

    const results = [...lessonResults, ...materialResults, ...answerResults].slice(0, 12)
    if (studentId && recordHistory) {
      runtimeSearchHistory = [
        {
          id: `sh${runtimeSearchHistory.length + 1}`,
          studentId,
          query: trimmedQuery,
          subjectId: effectiveSubjectId,
          lessonId: lessonId ?? null,
          resultCount: results.length,
          createdAt: new Date().toISOString(),
        },
        ...runtimeSearchHistory,
      ]
    }
    return clone(results)
  },

  async listHistory(studentId) {
    return clone(
      runtimeSearchHistory
        .filter((item) => item.studentId === studentId)
        .map((item) => ({
          ...item,
          subject: subjects.find((subject) => subject.id === item.subjectId) ?? null,
          lesson: curriculumLessons.find((lesson) => lesson.id === item.lessonId) ?? null,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    )
  },

  reset() {
    runtimeSearchHistory = clone(searchHistory)
  },
}
