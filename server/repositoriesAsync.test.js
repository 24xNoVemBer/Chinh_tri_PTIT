// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from './database.js'
import { createAsyncRepositories } from './repositoriesAsync.js'

describe('async repository boundary', () => {
  let db

  afterEach(() => db?.close())

  it('serves both vertical slices through the neutral query API', async () => {
    db = createDatabase({ databasePath: ':memory:' })
    const repositories = createAsyncRepositories(db)

    await expect(repositories.classRepository.listForLecturer('l1')).resolves.toHaveLength(2)
    await expect(repositories.learningRepository.getDashboard('s1')).resolves.toMatchObject({
      totalLessons: expect.any(Number),
    })

    const question = await repositories.questionRepository.create(
      {
        subjectId: 'sub1',
        lessonId: 'les3',
        content: 'Mối quan hệ giữa vật chất và ý thức được hiểu thế nào?',
      },
      's1',
    )
    expect(question.status).toBe('unanswered')

    const answer = await repositories.questionRepository.answer(
      question.id,
      { content: 'Vật chất và ý thức có mối quan hệ biện chứng, tác động qua lại.' },
      'l1',
    )
    expect(answer.questionId).toBe(question.id)

    const results = await repositories.searchRepository.search(
      { query: 'vật chất', subjectId: 'sub1', recordHistory: false },
      's1',
    )
    expect(results.length).toBeGreaterThan(0)
  })

  it('exposes only enrolled active credit classes to a student', async () => {
    db = createDatabase({ databasePath: ':memory:' })
    db.execute(
      `INSERT INTO course_classes
       (id, subject_id, name, semester, group_number, class_code, status)
       VALUES ('class-unenrolled', 'sub1', 'Lớp không ghi danh', '2026-HK1', 99, 'CT099', 'active')`,
    )
    const repositories = createAsyncRepositories(db)

    const overview = await repositories.learningRepository.getSubjectOverview('s1', 'sub1')
    expect(overview.classes.map((courseClass) => courseClass.id)).toEqual(['class1'])

    await expect(
      repositories.questionRepository.create(
        {
          subjectId: 'sub1',
          classId: 'class-unenrolled',
          content: 'Câu hỏi thử quyền truy cập lớp tín chỉ?',
        },
        's1',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
