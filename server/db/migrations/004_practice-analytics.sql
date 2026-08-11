ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS class_id TEXT REFERENCES course_classes(id);

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (mode IN ('standard', 'retry_wrong'));

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS source_session_id TEXT REFERENCES practice_sessions(id);

ALTER TABLE practice_session_questions
  ADD COLUMN IF NOT EXISTS started_at TEXT;

ALTER TABLE practice_session_questions
  ADD COLUMN IF NOT EXISTS answer_duration_ms INTEGER
  CHECK (answer_duration_ms IS NULL OR answer_duration_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_class_status_updated
  ON practice_sessions(class_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_student_subject_updated
  ON practice_sessions(student_id, subject_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_session_questions_question_correct
  ON practice_session_questions(question_id, is_correct);
