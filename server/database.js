import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { enrollmentProfiles, classMaterials } from '../src/data/mock-class-management.js'
import { chapters, courseClasses, enrollments, subjects } from '../src/data/mock-classes.js'
import { classLessons, curriculumLessons } from '../src/data/mock-lessons.js'
import { lecturerAnswers, studentQuestions } from '../src/data/mock-questions.js'
import { practiceQuestions } from '../src/data/mock-practice-questions.js'
import {
  initialQuestionMockResponses,
  learningProgress,
  searchHistory,
  subjectMockResponses,
} from '../src/data/mock-student-learning.js'
import {
  aiResponses,
  approvedSources,
  citations,
  materials,
  materialVersions,
} from '../src/data/mock-sources.js'
import { lecturers, students } from '../src/data/mock-users.js'
import { hashPassword } from './auth.js'
import { createSqliteClient } from './db/client.js'

const DEFAULT_DATABASE_PATH = resolve('data', 'ptit-teaching-assistant.sqlite')

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK (role IN ('student', 'lecturer')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL CHECK (credits > 0)
  );

  CREATE TABLE IF NOT EXISTS course_classes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    name TEXT NOT NULL,
    lecturer_id TEXT NOT NULL REFERENCES users(id),
    semester TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    class_id TEXT NOT NULL REFERENCES course_classes(id),
    UNIQUE (student_id, class_id)
  );

  CREATE TABLE IF NOT EXISTS enrollment_profiles (
    enrollment_id TEXT PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'attention', 'inactive')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    last_active_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    chapter_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    UNIQUE (subject_id, chapter_order)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id),
    lesson_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    UNIQUE (chapter_id, lesson_order)
  );

  CREATE TABLE IF NOT EXISTS class_lessons (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES course_classes(id),
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    lesson_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE (class_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    author TEXT NOT NULL,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS material_versions (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE (material_id, year)
  );

  CREATE TABLE IF NOT EXISTS approved_sources (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL UNIQUE REFERENCES materials(id) ON DELETE CASCADE,
    is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS class_materials (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES course_classes(id),
    material_id TEXT NOT NULL REFERENCES materials(id),
    version_id TEXT NOT NULL REFERENCES material_versions(id),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    added_by TEXT REFERENCES users(id),
    added_at TEXT NOT NULL,
    UNIQUE (class_id, material_id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT REFERENCES lessons(id),
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('unanswered', 'answered')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS practice_questions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    chapter_id TEXT NOT NULL REFERENCES chapters(id),
    lesson_id TEXT REFERENCES lessons(id),
    content TEXT NOT NULL,
    explanation TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    source_type TEXT NOT NULL DEFAULT 'manual',
    created_by TEXT NOT NULL REFERENCES users(id),
    published_by TEXT REFERENCES users(id),
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (subject_id, content)
  );

  CREATE TABLE IF NOT EXISTS practice_question_options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
    option_key TEXT NOT NULL CHECK (option_key IN ('A', 'B', 'C', 'D')),
    content TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    option_order INTEGER NOT NULL CHECK (option_order BETWEEN 1 AND 4),
    UNIQUE (question_id, option_key),
    UNIQUE (question_id, option_order)
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    chapter_id TEXT REFERENCES chapters(id),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    question_count INTEGER NOT NULL CHECK (question_count > 0),
    answered_count INTEGER NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS practice_session_questions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES practice_questions(id),
    position INTEGER NOT NULL CHECK (position > 0),
    selected_option_id TEXT REFERENCES practice_question_options(id),
    is_correct INTEGER CHECK (is_correct IN (0, 1)),
    answered_at TEXT,
    UNIQUE (session_id, question_id),
    UNIQUE (session_id, position)
  );

  CREATE TABLE IF NOT EXISTS lecturer_answers (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
    lecturer_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS rag_requests (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id),
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    lesson_id TEXT REFERENCES lessons(id),
    status TEXT NOT NULL CHECK (
      status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')
    ),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    request_json TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rag_responses (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE REFERENCES rag_requests(id) ON DELETE CASCADE,
    provider_answer_id TEXT,
    content TEXT NOT NULL,
    original_content TEXT NOT NULL,
    confidence REAL,
    review_status TEXT NOT NULL CHECK (
      review_status IN ('pending_review', 'approved', 'rejected', 'needs_revision')
    ),
    model_version TEXT,
    raw_response_json TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rag_citations (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES rag_responses(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL REFERENCES materials(id),
    material_version_id TEXT NOT NULL REFERENCES material_versions(id),
    page_number INTEGER,
    quote TEXT NOT NULL,
    citation_order INTEGER NOT NULL DEFAULT 0,
    retrieval_score REAL,
    UNIQUE (response_id, citation_order)
  );

  CREATE TABLE IF NOT EXISTS rag_reviews (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES rag_responses(id) ON DELETE CASCADE,
    lecturer_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'needs_revision')),
    content TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mock_response_templates (
    subject_id TEXT PRIMARY KEY REFERENCES subjects(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_label TEXT NOT NULL,
    material_id TEXT REFERENCES materials(id)
  );

  CREATE TABLE IF NOT EXISTS mock_responses (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_label TEXT NOT NULL,
    material_id TEXT REFERENCES materials(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_progress (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
    last_read_at TEXT NOT NULL,
    UNIQUE (student_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users(id),
    query TEXT NOT NULL,
    subject_id TEXT REFERENCES subjects(id),
    lesson_id TEXT REFERENCES lessons(id),
    result_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_login_limits (
    scope_key TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
    window_started_at TEXT NOT NULL,
    blocked_until TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_classes_lecturer ON course_classes(lecturer_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
  CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id, status);
  CREATE INDEX IF NOT EXISTS idx_practice_questions_scope
    ON practice_questions(subject_id, chapter_id, status);
  CREATE INDEX IF NOT EXISTS idx_practice_questions_creator
    ON practice_questions(created_by, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_practice_sessions_student
    ON practice_sessions(student_id, status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_practice_session_questions_session
    ON practice_session_questions(session_id, position);
  CREATE INDEX IF NOT EXISTS idx_rag_requests_question
    ON rag_requests(question_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rag_responses_review
    ON rag_responses(review_status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_rag_citations_response
    ON rag_citations(response_id, citation_order);
  CREATE INDEX IF NOT EXISTS idx_rag_reviews_response
    ON rag_reviews(response_id, created_at DESC);  CREATE INDEX IF NOT EXISTS idx_search_history_student ON search_history(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_auth_login_limits_updated
    ON auth_login_limits(updated_at);
  CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
`

function seedDatabase(db) {
  const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
  if (existingUsers > 0) return

  const createdAt = '2023-09-01T00:00:00.000Z'
  const studentPasswordHash = hashPassword('Student@123')
  const lecturerPasswordHash = hashPassword('Lecturer@123')

  db.exec('BEGIN IMMEDIATE')
  try {
    const insertUser = db.prepare(
      `INSERT INTO users (id, name, email, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const user of students) {
      insertUser.run(user.id, user.name, user.email, 'student', studentPasswordHash, createdAt)
    }
    for (const user of lecturers) {
      insertUser.run(user.id, user.name, user.email, 'lecturer', lecturerPasswordHash, createdAt)
    }

    const insertSubject = db.prepare('INSERT INTO subjects (id, name, credits) VALUES (?, ?, ?)')
    for (const subject of subjects) insertSubject.run(subject.id, subject.name, subject.credits)

    const insertClass = db.prepare(
      `INSERT INTO course_classes (id, subject_id, name, lecturer_id, semester)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const courseClass of courseClasses) {
      insertClass.run(
        courseClass.id,
        courseClass.subjectId,
        courseClass.name,
        courseClass.lecturerId,
        courseClass.semester,
      )
    }

    const insertEnrollment = db.prepare(
      'INSERT INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)',
    )
    for (const enrollment of enrollments) {
      insertEnrollment.run(enrollment.id, enrollment.studentId, enrollment.classId)
    }

    const insertProfile = db.prepare(
      `INSERT INTO enrollment_profiles (enrollment_id, status, progress, last_active_at)
       VALUES (?, ?, ?, ?)`,
    )
    for (const profile of enrollmentProfiles) {
      insertProfile.run(
        profile.enrollmentId,
        profile.status,
        profile.progress,
        profile.lastActiveAt,
      )
    }

    const insertChapter = db.prepare(
      `INSERT INTO chapters (id, subject_id, chapter_order, title)
       VALUES (?, ?, ?, ?)`,
    )
    for (const chapter of chapters) {
      insertChapter.run(chapter.id, chapter.subjectId, chapter.order, chapter.title)
    }

    const insertLesson = db.prepare(
      `INSERT INTO lessons (id, chapter_id, lesson_order, title, content_html)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const lesson of curriculumLessons) {
      insertLesson.run(lesson.id, lesson.chapterId, lesson.order, lesson.title, lesson.contentHtml)
    }

    const insertClassLesson = db.prepare(
      `INSERT INTO class_lessons
       (id, class_id, lesson_id, lesson_date, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const lesson of classLessons) {
      const courseClass = courseClasses.find((item) => item.id === lesson.classId)
      insertClassLesson.run(
        lesson.id,
        lesson.classId,
        lesson.lessonId,
        lesson.date,
        lesson.status,
        courseClass?.lecturerId ?? null,
        createdAt,
      )
    }

    const insertMaterial = db.prepare(
      `INSERT INTO materials
       (id, subject_id, title, type, author, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const material of materials) {
      insertMaterial.run(
        material.id,
        material.subjectId,
        material.title,
        material.type,
        material.author,
        'l1',
        createdAt,
      )
    }

    const insertVersion = db.prepare(
      `INSERT INTO material_versions
       (id, material_id, year, file_url, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const version of materialVersions) {
      insertVersion.run(
        version.id,
        version.materialId,
        version.year,
        version.fileUrl,
        'l1',
        createdAt,
      )
    }

    const insertApproved = db.prepare(
      `INSERT INTO approved_sources
       (id, material_id, is_approved, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const source of approvedSources) {
      insertApproved.run(
        source.id,
        source.materialId,
        source.isApproved ? 1 : 0,
        source.isApproved ? 'l1' : null,
        source.isApproved ? createdAt : null,
      )
    }

    const insertClassMaterial = db.prepare(
      `INSERT INTO class_materials
       (id, class_id, material_id, version_id, status, added_by, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const material of classMaterials) {
      const courseClass = courseClasses.find((item) => item.id === material.classId)
      insertClassMaterial.run(
        material.id,
        material.classId,
        material.materialId,
        material.versionId,
        material.status,
        courseClass?.lecturerId ?? null,
        material.addedAt,
      )
    }

    const insertQuestion = db.prepare(
      `INSERT INTO questions
       (id, lesson_id, subject_id, student_id, content, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const question of studentQuestions) {
      const lesson = curriculumLessons.find((item) => item.id === question.lessonId)
      const chapter = chapters.find((item) => item.id === lesson?.chapterId)
      const subjectId = question.subjectId ?? chapter?.subjectId
      insertQuestion.run(
        question.id,
        question.lessonId,
        subjectId,
        question.studentId,
        question.content,
        question.status,
        question.createdAt,
        question.createdAt,
      )
    }

    const insertPracticeQuestion = db.prepare(
      `INSERT INTO practice_questions
       (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
        source_type, created_by, published_by, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertPracticeOption = db.prepare(
      `INSERT INTO practice_question_options
       (id, question_id, option_key, content, is_correct, option_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const question of practiceQuestions) {
      insertPracticeQuestion.run(
        question.id,
        question.subjectId,
        question.chapterId,
        question.lessonId ?? null,
        question.content,
        question.explanation,
        question.difficulty,
        question.status,
        'manual',
        question.createdBy,
        question.publishedBy ?? null,
        question.publishedAt ?? null,
        question.createdAt,
        question.createdAt,
      )
      question.options.forEach((option, index) => {
        insertPracticeOption.run(
          option.id,
          question.id,
          option.key,
          option.content,
          option.isCorrect ? 1 : 0,
          index + 1,
        )
      })
    }

    const insertAnswer = db.prepare(
      `INSERT INTO lecturer_answers
       (id, question_id, lecturer_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const answer of lecturerAnswers) {
      insertAnswer.run(
        answer.id,
        answer.questionId,
        answer.lecturerId,
        answer.content,
        answer.createdAt,
        answer.updatedAt ?? null,
      )
    }

    const insertTemplate = db.prepare(
      `INSERT INTO mock_response_templates
       (subject_id, title, content, source_label, material_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const template of subjectMockResponses) {
      insertTemplate.run(
        template.subjectId,
        template.title,
        template.content,
        template.sourceLabel,
        template.materialId,
      )
    }

    const insertMockResponse = db.prepare(
      `INSERT INTO mock_responses
       (id, question_id, subject_id, title, content, source_label, material_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const response of initialQuestionMockResponses) {
      insertMockResponse.run(
        response.id,
        response.questionId,
        response.subjectId,
        response.title,
        response.content,
        response.sourceLabel,
        response.materialId,
        response.createdAt,
      )
    }

    const insertProgress = db.prepare(
      `INSERT INTO learning_progress
       (id, student_id, lesson_id, progress, last_read_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const progress of learningProgress) {
      insertProgress.run(
        progress.id,
        progress.studentId,
        progress.lessonId,
        progress.progress,
        progress.lastReadAt,
      )
    }

    const insertSearch = db.prepare(
      `INSERT INTO search_history
       (id, student_id, query, subject_id, lesson_id, result_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const item of searchHistory) {
      insertSearch.run(
        item.id,
        item.studentId,
        item.query,
        item.subjectId,
        item.lessonId,
        item.resultCount,
        item.createdAt,
      )
    }

    db.prepare(
      `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '3')`,
    ).run()
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function seedDemoRagData(db) {
  if (process.env.NODE_ENV === 'production' || process.env.RAG_DEMO_DATA === 'false') return

  const insertRequest = db.prepare(
    `INSERT OR IGNORE INTO rag_requests
     (id, question_id, student_id, subject_id, lesson_id, status, attempt_count,
      request_json, started_at, completed_at, created_at)
     SELECT ?, questions.id, questions.student_id, questions.subject_id, questions.lesson_id,
            'succeeded', 1, ?, ?, ?, ?
     FROM questions
     WHERE questions.id = ?`,
  )
  const insertResponse = db.prepare(
    `INSERT OR IGNORE INTO rag_responses
     (id, request_id, provider_answer_id, content, original_content, confidence,
      review_status, model_version, raw_response_json, reviewed_by, reviewed_at,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'demo-ui-v1', ?, ?, ?, ?, ?)`,
  )
  const insertCitation = db.prepare(
    `INSERT OR IGNORE INTO rag_citations
     (id, response_id, material_id, material_version_id, page_number, quote,
      citation_order, retrieval_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const aiResponse of aiResponses) {
      const requestId = `demo_request_${aiResponse.id}`
      const responseId = `demo_response_${aiResponse.id}`
      const reviewStatus = aiResponse.status === 'generated' ? 'pending_review' : aiResponse.status
      const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(aiResponse.questionId)
      if (!question) continue

      insertRequest.run(
        requestId,
        JSON.stringify({
          demo: true,
          questionId: question.id,
          question: question.content,
          subjectId: question.subject_id,
          lessonId: question.lesson_id,
        }),
        aiResponse.createdAt,
        aiResponse.createdAt,
        aiResponse.createdAt,
        question.id,
      )
      insertResponse.run(
        responseId,
        requestId,
        aiResponse.id,
        aiResponse.content,
        aiResponse.content,
        reviewStatus === 'approved' ? 0.91 : 0.78,
        reviewStatus,
        JSON.stringify({ demo: true, source: 'ui-fixture' }),
        aiResponse.lecturerId ?? null,
        reviewStatus === 'approved' ? aiResponse.createdAt : null,
        aiResponse.createdAt,
        aiResponse.createdAt,
      )

      citations
        .filter((citation) => citation.aiResponseId === aiResponse.id)
        .forEach((citation, index) => {
          const version = materialVersions.find((item) => item.id === citation.materialVersionId)
          if (!version) return
          insertCitation.run(
            `demo_${citation.id}`,
            responseId,
            version.materialId,
            citation.materialVersionId,
            citation.pageNumber ?? null,
            citation.quote,
            index,
            null,
          )
        })

      if (reviewStatus === 'approved') {
        db.prepare(`UPDATE questions SET status = 'answered', updated_at = ? WHERE id = ?`).run(
          aiResponse.createdAt,
          question.id,
        )
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function createDatabase({ databasePath = DEFAULT_DATABASE_PATH, seed = true } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })

  const db = createSqliteClient(new DatabaseSync(databasePath))
  db.exec(SCHEMA)
  if (databasePath !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  if (seed) {
    seedDatabase(db)
    seedDemoRagData(db)
  }
  db.prepare(`INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '3')`).run()
  return db
}

export { DEFAULT_DATABASE_PATH }
