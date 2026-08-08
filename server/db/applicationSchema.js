// Parent tables must appear before dependent tables for deterministic imports.
export const DATA_TABLE_ORDER = Object.freeze([
  'schema_meta',
  'users',
  'subjects',
  'course_classes',
  'enrollments',
  'enrollment_profiles',
  'chapters',
  'lessons',
  'class_lessons',
  'materials',
  'material_versions',
  'approved_sources',
  'class_materials',
  'questions',
  'lecturer_answers',
  'rag_requests',
  'rag_responses',
  'rag_citations',
  'rag_reviews',
  'mock_response_templates',
  'mock_responses',
  'learning_progress',
  'search_history',
  'sessions',
  'audit_logs',
])

export const RUNTIME_TABLES = Object.freeze(['auth_login_limits'])

export const POSTGRES_PUBLIC_TABLES = Object.freeze([
  ...DATA_TABLE_ORDER,
  ...RUNTIME_TABLES,
  'schema_migrations',
])

export const STAGING_DISABLED_PASSWORD_HASH = 'disabled$staging-import'
