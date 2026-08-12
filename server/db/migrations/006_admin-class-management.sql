-- Scoped administration and multi-lecturer credit classes.
-- The legacy course_classes.lecturer_id column remains during the dual-read transition.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'lecturer', 'admin'));
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1
  CHECK (auth_version > 0);

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

CREATE TABLE IF NOT EXISTS academic_terms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('upcoming', 'active', 'completed', 'archived'))
);

ALTER TABLE course_classes
  ADD COLUMN IF NOT EXISTS academic_term_id TEXT REFERENCES academic_terms(id);
ALTER TABLE course_classes
  ADD COLUMN IF NOT EXISTS group_number INTEGER
  CHECK (group_number IS NULL OR group_number > 0);
ALTER TABLE course_classes ADD COLUMN IF NOT EXISTS class_code TEXT;
ALTER TABLE course_classes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'completed', 'archived'));

INSERT INTO academic_terms (id, code, name, status)
SELECT 'term_' || SUBSTRING(MD5(semester) FROM 1 FOR 12),
       semester,
       'Năm học ' || semester,
       'active'
FROM course_classes
GROUP BY semester
ON CONFLICT (code) DO NOTHING;

UPDATE course_classes
SET academic_term_id = academic_terms.id
FROM academic_terms
WHERE course_classes.academic_term_id IS NULL
  AND academic_terms.code = course_classes.semester;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY subject_id, academic_term_id
           ORDER BY name, id
         ) AS generated_group_number
  FROM course_classes
)
UPDATE course_classes
SET group_number = ranked.generated_group_number
FROM ranked
WHERE course_classes.id = ranked.id
  AND course_classes.group_number IS NULL;

UPDATE course_classes
SET class_code = CASE
  WHEN POSITION(' - ' IN name) > 0 THEN SUBSTRING(name FROM 1 FOR POSITION(' - ' IN name) - 1)
  ELSE name
END
WHERE class_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_term_group
  ON course_classes(subject_id, academic_term_id, group_number)
  WHERE academic_term_id IS NOT NULL AND group_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_term_code
  ON course_classes(subject_id, academic_term_id, class_code)
  WHERE academic_term_id IS NOT NULL AND class_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS class_lecturer_assignments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES course_classes(id) ON DELETE CASCADE,
  lecturer_id TEXT NOT NULL REFERENCES users(id),
  assignment_role TEXT NOT NULL DEFAULT 'lecturer'
    CHECK (assignment_role IN ('lead', 'lecturer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_by TEXT REFERENCES users(id),
  assigned_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE (class_id, lecturer_id)
);

INSERT INTO class_lecturer_assignments
  (id, class_id, lecturer_id, assignment_role, status, assigned_at)
SELECT 'assignment_' || id || '_' || lecturer_id,
       id,
       lecturer_id,
       'lead',
       'active',
       '2026-08-12T00:00:00.000Z'
FROM course_classes
WHERE lecturer_id IS NOT NULL
ON CONFLICT (class_id, lecturer_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_class_lecturers_lecturer
  ON class_lecturer_assignments(lecturer_id, status, class_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_lecturers_one_active_lead
  ON class_lecturer_assignments(class_id)
  WHERE assignment_role = 'lead' AND status = 'active';

ALTER TABLE questions ADD COLUMN IF NOT EXISTS class_id TEXT REFERENCES course_classes(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS claimed_by TEXT REFERENCES users(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS claimed_at TEXT;
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS routing_status TEXT NOT NULL DEFAULT 'queued'
  CHECK (routing_status IN ('unrouted', 'queued', 'claimed', 'answered', 'closed'));
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 0 CHECK (row_version >= 0);

UPDATE questions
SET class_id = (
  SELECT course_classes.id
  FROM enrollments
  JOIN course_classes ON course_classes.id = enrollments.class_id
  WHERE enrollments.student_id = questions.student_id
    AND course_classes.subject_id = questions.subject_id
  ORDER BY course_classes.id
  LIMIT 1
)
WHERE questions.class_id IS NULL;

UPDATE questions
SET routing_status = CASE
  WHEN status = 'answered' THEN 'answered'
  WHEN class_id IS NULL THEN 'unrouted'
  ELSE 'queued'
END;

UPDATE questions
SET claimed_by = lecturer_answers.lecturer_id,
    claimed_at = lecturer_answers.created_at
FROM lecturer_answers
WHERE lecturer_answers.question_id = questions.id
  AND questions.status = 'answered';

CREATE INDEX IF NOT EXISTS idx_questions_class_queue
  ON questions(class_id, routing_status, created_at DESC);

ALTER TABLE practice_questions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'lecturer_owned'
  CHECK (scope IN ('subject_shared', 'lecturer_owned'));

CREATE TABLE IF NOT EXISTS practice_question_class_assignments (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES course_classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL,
  UNIQUE (question_id, class_id)
);

INSERT INTO practice_question_class_assignments
  (id, question_id, class_id, status, assigned_by, assigned_at)
SELECT 'practice_assignment_' || practice_questions.id || '_' || course_classes.id,
       practice_questions.id,
       course_classes.id,
       'published',
       practice_questions.created_by,
       practice_questions.created_at
FROM practice_questions
JOIN class_lecturer_assignments
  ON class_lecturer_assignments.lecturer_id = practice_questions.created_by
 AND class_lecturer_assignments.status = 'active'
JOIN course_classes
  ON course_classes.id = class_lecturer_assignments.class_id
 AND course_classes.subject_id = practice_questions.subject_id
ON CONFLICT (question_id, class_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_practice_question_classes
  ON practice_question_class_assignments(class_id, status, question_id);
