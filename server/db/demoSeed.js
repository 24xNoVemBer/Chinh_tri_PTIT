import { hashPassword } from '../auth.js'
import { chapters, subjects } from '../../src/data/mock-classes.js'
import { lecturers as baseLecturers, students as baseStudents } from '../../src/data/mock-users.js'

const CREATED_AT = '2026-08-12T00:00:00.000Z'
const TERM_ID = 'term_demo_2026_hk1'
const TERM_CODE = '2026-HK1'

function pad(value) {
  return String(value).padStart(2, '0')
}

export const demoAccounts = {
  admins: [
    { id: 'admin1', name: 'Quản trị viên Demo 01', email: 'admin.demo01@ptit.edu.vn' },
    { id: 'admin2', name: 'Quản trị viên Demo 02', email: 'admin.demo02@ptit.edu.vn' },
  ],
  lecturers: [
    ...baseLecturers,
    ...Array.from({ length: 8 }, (_, index) => {
      const number = index + 3
      return {
        id: `l${number}`,
        name: `Giảng viên Demo ${pad(number)}`,
        email: `lecturer.demo${pad(number)}@ptit.edu.vn`,
      }
    }),
  ],
  students: [
    ...baseStudents,
    ...Array.from({ length: 35 }, (_, index) => {
      const number = index + 6
      return {
        id: `s${number}`,
        name: `Sinh viên Demo ${pad(number)}`,
        email: `student.demo${pad(number)}@ptit.edu.vn`,
      }
    }),
  ],
}

export const demoClasses = subjects.flatMap((subject, subjectIndex) =>
  [1, 2].map((groupNumber) => ({
    id: `demo-class-${pad(subjectIndex + 1)}-${pad(groupNumber)}`,
    subjectId: subject.id,
    name: `Tổ ${pad(groupNumber)} - ${subject.name}`,
    semester: TERM_CODE,
    groupNumber,
    classCode: `CT${pad(subjectIndex + 1)}${pad(groupNumber)}`,
  })),
)

function optionId(questionId, key) {
  return `${questionId}-${key.toLowerCase()}`
}

function buildSharedQuestions() {
  return subjects.flatMap((subject, subjectIndex) => {
    const subjectChapters = chapters.filter((chapter) => chapter.subjectId === subject.id)
    return Array.from({ length: 5 }, (_, questionIndex) => {
      const number = questionIndex + 1
      const id = `demo-shared-${pad(subjectIndex + 1)}-${pad(number)}`
      const chapter = subjectChapters[questionIndex % subjectChapters.length]
      return {
        id,
        subjectId: subject.id,
        chapterId: chapter.id,
        content: `[Demo ${subject.name}] Khẳng định phù hợp nhất cho câu số ${number} là gì?`,
        explanation: `Đáp án A minh họa nội dung chính của ${chapter.title}; dữ liệu này phục vụ kiểm thử giao diện và thống kê.`,
        options: ['A', 'B', 'C', 'D'].map((key) => ({
          id: optionId(id, key),
          key,
          content:
            key === 'A'
              ? `Nội dung đúng thuộc ${chapter.title}`
              : `Phương án nhiễu ${key} cho dữ liệu demo`,
          isCorrect: key === 'A',
        })),
      }
    })
  })
}

export const demoSharedQuestions = buildSharedQuestions()

export function assertDemoSeedAllowed({ nodeEnv, confirmed }) {
  if (nodeEnv === 'production') {
    throw new Error('Demo seed is disabled in production.')
  }
  if (!confirmed) {
    throw new Error('Demo seed requires the explicit --confirm-demo-seed flag.')
  }
}

async function upsertUser(transaction, user, role, passwordHash) {
  await transaction.execute(
    `INSERT INTO users
     (id, name, email, role, password_hash, status, auth_version, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, email = excluded.email, role = excluded.role, status = 'active'`,
    [user.id, user.name, user.email, role, passwordHash, CREATED_AT],
  )
}

export async function seedLargeDemoData(
  db,
  { nodeEnv = process.env.NODE_ENV ?? 'development', confirmed = false } = {},
) {
  assertDemoSeedAllowed({ nodeEnv, confirmed })
  const passwordHashes = {
    admin: hashPassword('Admin@123'),
    lecturer: hashPassword('Lecturer@123'),
    student: hashPassword('Student@123'),
  }

  await db.transaction(async (transaction) => {
    for (const user of demoAccounts.admins) {
      await upsertUser(transaction, user, 'admin', passwordHashes.admin)
    }
    for (const user of demoAccounts.lecturers) {
      await upsertUser(transaction, user, 'lecturer', passwordHashes.lecturer)
    }
    for (const user of demoAccounts.students) {
      await upsertUser(transaction, user, 'student', passwordHashes.student)
    }

    for (const subject of subjects) {
      await transaction.execute(
        `INSERT INTO subjects (id, name, credits, status)
         VALUES (?, ?, ?, 'active')
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, credits = excluded.credits, status = 'active'`,
        [subject.id, subject.name, subject.credits],
      )
    }
    for (const chapter of chapters) {
      await transaction.execute(
        `INSERT INTO chapters (id, subject_id, chapter_order, title)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           subject_id = excluded.subject_id, chapter_order = excluded.chapter_order,
           title = excluded.title`,
        [chapter.id, chapter.subjectId, chapter.order, chapter.title],
      )
    }
    await transaction.execute(
      `INSERT INTO academic_terms (id, code, name, starts_at, ends_at, status)
       VALUES (?, ?, 'Học kỳ 1 năm học 2026-2027', '2026-08-01', '2027-01-31', 'active')
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = 'active'`,
      [TERM_ID, TERM_CODE],
    )

    for (const [classIndex, courseClass] of demoClasses.entries()) {
      const legacyLecturer = demoAccounts.lecturers[classIndex % demoAccounts.lecturers.length]
      await transaction.execute(
        `INSERT INTO course_classes
         (id, subject_id, name, lecturer_id, semester, academic_term_id, group_number,
          class_code, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
         ON CONFLICT(id) DO UPDATE SET
           subject_id = excluded.subject_id, name = excluded.name,
           semester = excluded.semester, academic_term_id = excluded.academic_term_id,
           group_number = excluded.group_number, class_code = excluded.class_code,
           status = 'active'`,
        [
          courseClass.id,
          courseClass.subjectId,
          courseClass.name,
          legacyLecturer.id,
          courseClass.semester,
          TERM_ID,
          courseClass.groupNumber,
          courseClass.classCode,
        ],
      )
    }

    for (const [classIndex, courseClass] of demoClasses.entries()) {
      const lead = demoAccounts.lecturers[classIndex % demoAccounts.lecturers.length]
      const collaborator = demoAccounts.lecturers[(classIndex + 1) % demoAccounts.lecturers.length]
      for (const [assignmentIndex, lecturer] of [lead, collaborator].entries()) {
        const assignmentRole = assignmentIndex === 0 ? 'lead' : 'lecturer'
        await transaction.execute(
          `INSERT INTO class_lecturer_assignments
           (id, class_id, lecturer_id, assignment_role, status, assigned_by, assigned_at, ended_at)
           VALUES (?, ?, ?, ?, 'active', 'admin1', ?, NULL)
           ON CONFLICT(class_id, lecturer_id) DO UPDATE SET
             assignment_role = excluded.assignment_role, status = 'active',
             assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at,
             ended_at = NULL`,
          [
            `demo-assignment-${courseClass.id}-${lecturer.id}`,
            courseClass.id,
            lecturer.id,
            assignmentRole,
            CREATED_AT,
          ],
        )
      }
    }

    const classBySubject = new Map(
      subjects.map((subject) => [
        subject.id,
        demoClasses.filter((courseClass) => courseClass.subjectId === subject.id),
      ]),
    )
    const enrollmentRows = []
    for (const [studentIndex, student] of demoAccounts.students.entries()) {
      for (const subject of subjects) {
        const subjectClasses = classBySubject.get(subject.id)
        const courseClass = subjectClasses[studentIndex % subjectClasses.length]
        const enrollment = {
          id: `demo-enrollment-${student.id}-${courseClass.id}`,
          studentId: student.id,
          classId: courseClass.id,
          subjectId: subject.id,
        }
        enrollmentRows.push(enrollment)
        await transaction.execute(
          `INSERT INTO enrollments (id, student_id, class_id)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET student_id = excluded.student_id, class_id = excluded.class_id`,
          [enrollment.id, student.id, courseClass.id],
        )
        await transaction.execute(
          `INSERT INTO enrollment_profiles (enrollment_id, status, progress, last_active_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(enrollment_id) DO UPDATE SET
             status = excluded.status, progress = excluded.progress,
             last_active_at = excluded.last_active_at`,
          [
            enrollment.id,
            studentIndex % 11 === 0 ? 'attention' : 'active',
            20 + ((studentIndex * 13 + subjects.indexOf(subject) * 7) % 81),
            `2026-08-${pad((studentIndex % 12) + 1)}T09:00:00.000Z`,
          ],
        )
      }
    }

    for (const question of demoSharedQuestions) {
      await transaction.execute(
        `INSERT INTO practice_questions
         (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
          source_type, scope, created_by, published_by, published_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, 'medium', 'published', 'manual', 'subject_shared',
                 'admin1', 'admin1', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content, explanation = excluded.explanation,
           status = 'published', scope = 'subject_shared', updated_at = excluded.updated_at`,
        [
          question.id,
          question.subjectId,
          question.chapterId,
          question.content,
          question.explanation,
          CREATED_AT,
          CREATED_AT,
          CREATED_AT,
        ],
      )
      for (const [optionIndex, option] of question.options.entries()) {
        await transaction.execute(
          `INSERT INTO practice_question_options
           (id, question_id, option_key, content, is_correct, option_order)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             content = excluded.content, is_correct = excluded.is_correct,
             option_order = excluded.option_order`,
          [
            option.id,
            question.id,
            option.key,
            option.content,
            option.isCorrect ? 1 : 0,
            optionIndex + 1,
          ],
        )
      }
    }

    for (const [classIndex, courseClass] of demoClasses.entries()) {
      const owner = demoAccounts.lecturers[classIndex % demoAccounts.lecturers.length]
      const chapter = chapters.find((item) => item.subjectId === courseClass.subjectId)
      for (const number of [1, 2]) {
        const questionId = `demo-private-${courseClass.id}-${number}`
        await transaction.execute(
          `INSERT INTO practice_questions
           (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
            source_type, scope, created_by, published_by, published_at, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, 'medium', 'published', 'manual', 'lecturer_owned',
                   ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             content = excluded.content, explanation = excluded.explanation,
             status = 'published', updated_at = excluded.updated_at`,
          [
            questionId,
            courseClass.subjectId,
            chapter.id,
            `[${courseClass.classCode}] Câu ôn tập riêng số ${number}?`,
            `Giải thích demo cho câu hỏi riêng của ${courseClass.classCode}.`,
            owner.id,
            owner.id,
            CREATED_AT,
            CREATED_AT,
            CREATED_AT,
          ],
        )
        for (const [optionIndex, key] of ['A', 'B', 'C', 'D'].entries()) {
          await transaction.execute(
            `INSERT INTO practice_question_options
             (id, question_id, option_key, content, is_correct, option_order)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               content = excluded.content, is_correct = excluded.is_correct,
               option_order = excluded.option_order`,
            [
              optionId(questionId, key),
              questionId,
              key,
              key === 'A' ? 'Đáp án đúng của lớp' : `Phương án nhiễu ${key}`,
              key === 'A' ? 1 : 0,
              optionIndex + 1,
            ],
          )
        }
        await transaction.execute(
          `INSERT INTO practice_question_class_assignments
           (id, question_id, class_id, status, assigned_by, assigned_at)
           VALUES (?, ?, ?, 'published', ?, ?)
           ON CONFLICT(question_id, class_id) DO UPDATE SET status = 'published'`,
          [
            `demo-question-assignment-${questionId}`,
            questionId,
            courseClass.id,
            owner.id,
            CREATED_AT,
          ],
        )
      }
    }

    for (const [enrollmentIndex, enrollment] of enrollmentRows.entries()) {
      const questionPool = demoSharedQuestions.filter(
        (question) => question.subjectId === enrollment.subjectId,
      )
      const sessionId = `demo-session-${enrollment.studentId}-${enrollment.classId}`
      const sessionType = enrollmentIndex % 4 === 0 ? 'mock_exam' : 'practice'
      const completed = enrollmentIndex % 9 !== 0
      const correctCount = [0, 1, 2, 3][enrollmentIndex % 4]
      const answeredCount = completed ? 3 : 1
      await transaction.execute(
        `INSERT INTO practice_sessions
         (id, student_id, subject_id, chapter_id, class_id, mode, session_type,
          source_session_id, status, question_count, answered_count, correct_count,
          started_at, completed_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, 'standard', ?, NULL, ?, 3, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status, answered_count = excluded.answered_count,
           correct_count = excluded.correct_count, completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
        [
          sessionId,
          enrollment.studentId,
          enrollment.subjectId,
          enrollment.classId,
          sessionType,
          completed ? 'completed' : 'in_progress',
          answeredCount,
          Math.min(correctCount, answeredCount),
          `2026-08-${pad((enrollmentIndex % 12) + 1)}T08:00:00.000Z`,
          completed ? `2026-08-${pad((enrollmentIndex % 12) + 1)}T08:15:00.000Z` : null,
          `2026-08-${pad((enrollmentIndex % 12) + 1)}T08:15:00.000Z`,
        ],
      )
      for (const [positionIndex, question] of questionPool.slice(0, 3).entries()) {
        const position = positionIndex + 1
        const answered = position <= answeredCount
        const isCorrect = answered && position <= correctCount
        await transaction.execute(
          `INSERT INTO practice_session_questions
           (id, session_id, question_id, position, selected_option_id, is_correct,
            answered_at, started_at, answer_duration_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             selected_option_id = excluded.selected_option_id,
             is_correct = excluded.is_correct, answered_at = excluded.answered_at,
             answer_duration_ms = excluded.answer_duration_ms`,
          [
            `demo-session-item-${sessionId}-${position}`,
            sessionId,
            question.id,
            position,
            answered ? optionId(question.id, isCorrect ? 'A' : 'B') : null,
            answered ? (isCorrect ? 1 : 0) : null,
            answered ? `2026-08-${pad((enrollmentIndex % 12) + 1)}T08:05:00.000Z` : null,
            `2026-08-${pad((enrollmentIndex % 12) + 1)}T08:00:00.000Z`,
            answered ? 45000 + position * 5000 : null,
          ],
        )
      }
    }

    for (const [studentIndex, student] of demoAccounts.students.entries()) {
      for (const subjectIndex of [0, 1]) {
        const subject = subjects[subjectIndex]
        const enrollment = enrollmentRows.find(
          (item) => item.studentId === student.id && item.subjectId === subject.id,
        )
        const courseClass = demoClasses.find((item) => item.id === enrollment.classId)
        const classIndex = demoClasses.findIndex((item) => item.id === courseClass.id)
        const assignedLecturer = demoAccounts.lecturers[classIndex % demoAccounts.lecturers.length]
        const questionId = `demo-qna-${student.id}-${subject.id}`
        const answered = (studentIndex + subjectIndex) % 3 === 0
        const claimed = !answered && (studentIndex + subjectIndex) % 3 === 1
        const createdAt = `2026-08-${pad((studentIndex % 12) + 1)}T07:00:00.000Z`
        await transaction.execute(
          `INSERT INTO questions
           (id, lesson_id, subject_id, student_id, class_id, claimed_by, claimed_at,
            routing_status, row_version, content, status, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             class_id = excluded.class_id, claimed_by = excluded.claimed_by,
             claimed_at = excluded.claimed_at, routing_status = excluded.routing_status,
             row_version = excluded.row_version, content = excluded.content,
             status = excluded.status, updated_at = excluded.updated_at`,
          [
            questionId,
            subject.id,
            student.id,
            courseClass.id,
            answered || claimed ? assignedLecturer.id : null,
            answered || claimed ? createdAt : null,
            answered ? 'answered' : claimed ? 'claimed' : 'queued',
            answered || claimed ? 1 : 0,
            `[Demo] Sinh viên ${student.name} hỏi về ${subject.name}?`,
            answered ? 'answered' : 'unanswered',
            createdAt,
            createdAt,
          ],
        )
        if (answered) {
          await transaction.execute(
            `INSERT INTO lecturer_answers
             (id, question_id, lecturer_id, content, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(question_id) DO UPDATE SET
               lecturer_id = excluded.lecturer_id, content = excluded.content,
               updated_at = excluded.updated_at`,
            [
              `demo-answer-${questionId}`,
              questionId,
              assignedLecturer.id,
              `Câu trả lời demo đã được giảng viên đối chiếu trong phạm vi ${courseClass.classCode}.`,
              createdAt,
              createdAt,
            ],
          )
        } else {
          await transaction.execute('DELETE FROM lecturer_answers WHERE question_id = ?', [
            questionId,
          ])
        }
      }
    }
  })

  const counts = await db.one(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
       (SELECT COUNT(*) FROM users WHERE role = 'lecturer') AS lecturers,
       (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
       (SELECT COUNT(*) FROM course_classes WHERE id LIKE 'demo-class-%') AS classes,
       (SELECT COUNT(*) FROM enrollments WHERE id LIKE 'demo-enrollment-%') AS enrollments,
       (SELECT COUNT(*) FROM practice_questions WHERE id LIKE 'demo-%') AS practice_questions,
       (SELECT COUNT(*) FROM practice_sessions WHERE id LIKE 'demo-session-%') AS sessions,
       (SELECT COUNT(*) FROM questions WHERE id LIKE 'demo-qna-%') AS qna_questions`,
  )
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)]))
}
