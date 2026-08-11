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

CREATE INDEX IF NOT EXISTS idx_practice_questions_scope
  ON practice_questions(subject_id, chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_practice_questions_creator
  ON practice_questions(created_by, updated_at);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student
  ON practice_sessions(student_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_practice_session_questions_session
  ON practice_session_questions(session_id, position);
