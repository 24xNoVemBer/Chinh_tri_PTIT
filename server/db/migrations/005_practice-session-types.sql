ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'practice'
  CHECK (session_type IN ('practice', 'mock_exam'));

CREATE INDEX IF NOT EXISTS idx_practice_sessions_student_type_updated
  ON practice_sessions(student_id, session_type, updated_at DESC);
