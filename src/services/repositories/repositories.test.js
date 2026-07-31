import { afterEach, describe, expect, it } from 'vitest'
import { classContentRepository } from './classContentRepository'
import { classRepository } from './classRepository'
import { learningRepository } from './learningRepository'
import { questionRepository } from './questionRepository'
import { searchRepository } from './searchRepository'
import { subjectRepository } from './subjectRepository'

afterEach(() => {
  classContentRepository.reset()
  classRepository.reset()
  learningRepository.reset()
  questionRepository.reset()
})

describe('mock repositories', () => {
  it('returns lecturer classes with summary counts', async () => {
    const classes = await classRepository.listForLecturer('l1')
    expect(classes).toHaveLength(2)
    expect(classes[0]).toMatchObject({ lecturerId: 'l1' })
    expect(classes[0].studentCount).toBeGreaterThan(0)
  })

  it('returns students with management status and persists runtime updates', async () => {
    const students = await classRepository.listStudents('class1', { lecturerId: 'l1' })
    expect(students[0]).toMatchObject({ classId: 'class1' })
    expect(students.every((student) => Number.isInteger(student.progress))).toBe(true)

    await classRepository.updateStudentStatus('class1', 's1', 'attention', {
      lecturerId: 'l1',
    })
    const updated = await classRepository.listStudents('class1', { status: 'attention' })
    expect(updated.some((student) => student.id === 's1')).toBe(true)
  })

  it('blocks a lecturer from opening another lecturer class', async () => {
    await expect(classRepository.getById('class1', { lecturerId: 'l2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('schedules and publishes a lesson through the class content repository', async () => {
    const available = await classContentRepository.listAvailableLessons('class1')
    const scheduled = await classContentRepository.scheduleLesson('class1', {
      lessonId: available[0].id,
      date: '2023-10-03',
    })
    expect(scheduled.status).toBe('draft')

    const published = await classContentRepository.updateLessonStatus(
      'class1',
      scheduled.id,
      'published',
    )
    expect(published.status).toBe('published')
  })

  it('attaches an approved material as a draft', async () => {
    const available = await classContentRepository.listAvailableMaterials('class1')
    const attached = await classContentRepository.attachMaterial('class1', {
      materialId: available[0].id,
    })
    expect(attached).toMatchObject({ classId: 'class1', status: 'draft' })
  })

  it('rejects content that does not belong to the class subject', async () => {
    await expect(
      classContentRepository.scheduleLesson('class1', {
        lessonId: 'les7',
        date: '2023-10-03',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    await expect(
      classContentRepository.attachMaterial('class1', { materialId: 'mat2' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('does not update content through a different class id', async () => {
    const lesson = await classContentRepository.updateLessonStatus('class2', 'cl1', 'draft')
    const material = await classContentRepository.updateMaterialStatus('class2', 'cm1', 'draft')
    expect(lesson).toBeNull()
    expect(material).toBeNull()
  })
  it('returns only subjects enrolled by a student', async () => {
    const subjects = await subjectRepository.listForStudent('s1')
    expect(subjects.map((subject) => subject.id)).toEqual(['sub1', 'sub2'])
  })

  it('creates a student question without mutating source fixtures', async () => {
    const created = await questionRepository.create({
      subjectId: 'sub1',
      lessonId: 'les1',
      studentId: 's1',
      content: '  Câu hỏi kiểm thử  ',
    })

    expect(created.content).toBe('Câu hỏi kiểm thử')
    expect(created.status).toBe('unanswered')
    expect(created.mockResponse).toMatchObject({ subjectId: 'sub1' })
  })

  it('protects student question details and validates lesson context', async () => {
    await expect(questionRepository.getForStudent('sq2', 's1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      questionRepository.create({
        subjectId: 'sub1',
        lessonId: 'les7',
        studentId: 's1',
        content: 'Bài học này có thuộc đúng môn em đang chọn không?',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('updates lesson progress and returns it in the student dashboard', async () => {
    await learningRepository.updateProgress('s1', 'les2', 100)
    const lesson = await learningRepository.getLessonForStudent('s1', 'les2')
    const dashboard = await learningRepository.getDashboard('s1')
    expect(lesson.progress).toBe(100)
    expect(dashboard.completedLessons).toBeGreaterThanOrEqual(3)
  })

  it('returns the next incomplete lesson for each enrolled subject', async () => {
    const subjects = await learningRepository.listSubjectProgress('s1')
    const philosophy = subjects.find((subject) => subject.id === 'sub1')

    expect(philosophy.nextLesson).toMatchObject({
      id: 'les2',
      title: 'Bài giảng 2: Phân tích chuyên sâu (Chương 1)',
      chapterId: 'chap1',
    })
    expect(philosophy.nextLesson).not.toHaveProperty('contentHtml')
  })
  it('falls back to the first unopened lesson after all started lessons are complete', async () => {
    await Promise.all([
      learningRepository.updateProgress('s1', 'les2', 100),
      learningRepository.updateProgress('s1', 'les3', 100),
      learningRepository.updateProgress('s1', 'les7', 100),
    ])

    const dashboard = await learningRepository.getDashboard('s1')

    expect(dashboard.recentLesson).toMatchObject({
      id: 'les4',
      progress: 0,
      lastReadAt: null,
    })
  })
  it('blocks access to a lesson outside the student enrollment', async () => {
    await expect(learningRepository.getLessonForStudent('s2', 'les7')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
  it('filters lecturer questions by class and status', async () => {
    const questions = await questionRepository.listForLecturer('l1', {
      classId: 'class1',
      status: 'unanswered',
    })
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((question) => question.courseClass.id === 'class1')).toBe(true)
    expect(questions.every((question) => question.status === 'unanswered')).toBe(true)
  })

  it('answers a question manually and updates its status', async () => {
    await questionRepository.answer('sq3', {
      lecturerId: 'l1',
      content: 'Đây là câu trả lời thủ công đủ dài để phục vụ kiểm thử.',
    })
    const question = await questionRepository.getForLecturer('sq3', 'l1')
    expect(question.status).toBe('answered')
    expect(question.lecturerAnswer.content).toContain('trả lời thủ công')
  })

  it('filters knowledge search by lesson and records student history', async () => {
    const before = await searchRepository.listHistory('s1')
    const results = await searchRepository.search({
      query: 'giới thiệu',
      studentId: 's1',
      subjectId: 'sub1',
      lessonId: 'les1',
    })
    const after = await searchRepository.listHistory('s1')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ lessonId: 'les1', sourceType: 'lesson' })
    expect(after).toHaveLength(before.length + 1)
    expect(after[0].query).toBe('giới thiệu')
  })
  it('searches Vietnamese text without requiring diacritics', async () => {
    const results = await searchRepository.search({ query: 'triet hoc' })
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches a lecturer answer from its original question text', async () => {
    const results = await searchRepository.search({ query: 'ý thức' })
    expect(results.some((result) => result.sourceType === 'answer')).toBe(true)
  })
})
