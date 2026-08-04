-- PTIT Teaching Assistant PostgreSQL baseline.
-- Keep application-facing identifiers and text timestamps compatible with DB-0
-- until the async repository migration is complete.

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'lecturer')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email));

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
  is_approved SMALLINT NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
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
  confidence DOUBLE PRECISION,
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
  retrieval_score DOUBLE PRECISION,
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
CREATE INDEX IF NOT EXISTS idx_rag_requests_question ON rag_requests(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_responses_review ON rag_responses(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_citations_response ON rag_citations(response_id, citation_order);
CREATE INDEX IF NOT EXISTS idx_rag_reviews_response ON rag_reviews(response_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_student ON search_history(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
