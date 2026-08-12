import { randomUUID } from 'node:crypto'
import { ApiError } from './http.js'

const nowIso = () => new Date().toISOString()
const createId = (prefix) => `${prefix}_${randomUUID()}`

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new ApiError(400, 'VALIDATION', `${label} không hợp lệ.`)
  }
}

function parseMetadata(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function requireEntity(db, table, id, label) {
  const row = await db.one(`SELECT * FROM ${table} WHERE id = ?`, [id])
  if (!row) throw new ApiError(404, 'NOT_FOUND', `Không tìm thấy ${label}.`)
  return row
}

async function writeAudit(db, actorId, action, entityType, entityId, metadata = null) {
  await db.execute(
    `INSERT INTO audit_logs
     (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      createId('audit'),
      actorId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      nowIso(),
    ],
  )
}

function mapClass(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    academicTermId: row.academic_term_id,
    groupNumber: row.group_number,
    classCode: row.class_code,
    name: row.name,
    semester: row.semester,
    status: row.status,
    subjectName: row.subject_name,
    termCode: row.term_code,
    termName: row.term_name,
    studentCount: Number(row.student_count ?? 0),
    lecturerCount: Number(row.lecturer_count ?? 0),
    unansweredCount: Number(row.unanswered_count ?? 0),
  }
}

function mapPracticeQuestion(row, options = []) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    chapterId: row.chapter_id,
    lessonId: row.lesson_id,
    content: row.content,
    explanation: row.explanation,
    status: row.status,
    scope: row.scope,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subjectName: row.subject_name,
    chapterTitle: row.chapter_title,
    options: options.map((option) => ({
      id: option.id,
      key: option.option_key,
      content: option.content,
      isCorrect: Boolean(option.is_correct),
    })),
  }
}

export function createAdminRepository(db) {
  return {
    async listUsers(filters = {}) {
      const rows = await db.many(
        `SELECT id, name, email, role, status, auth_version, created_at
         FROM users
         ORDER BY role, name`,
      )
      const query = String(filters.query ?? '')
        .trim()
        .toLocaleLowerCase('vi')
      return rows.filter((row) => {
        if (filters.role && filters.role !== 'all' && row.role !== filters.role) return false
        if (filters.status && filters.status !== 'all' && row.status !== filters.status)
          return false
        return !query || `${row.name} ${row.email}`.toLocaleLowerCase('vi').includes(query)
      })
    },

    async updateUser(userId, input, actorId) {
      const user = await requireEntity(db, 'users', userId, 'tài khoản')
      const role = input.role ?? user.role
      const status = input.status ?? user.status
      assertEnum(role, ['student', 'lecturer', 'admin'], 'Vai trò')
      assertEnum(status, ['active', 'inactive'], 'Trạng thái')
      if (
        user.role === 'admin' &&
        user.status === 'active' &&
        (role !== 'admin' || status !== 'active')
      ) {
        const activeAdmins = await db.one(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'",
        )
        if (Number(activeAdmins.count) <= 1) {
          throw new ApiError(
            409,
            'LAST_ACTIVE_ADMIN',
            'Không thể hạ quyền quản trị viên hoạt động cuối cùng.',
          )
        }
      }
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `UPDATE users
           SET role = ?, status = ?, auth_version = auth_version + 1
           WHERE id = ?`,
          [role, status, userId],
        )
        await transaction.execute('DELETE FROM sessions WHERE user_id = ?', [userId])
        await writeAudit(transaction, actorId, 'admin.user.updated', 'user', userId, {
          before: { role: user.role, status: user.status },
          after: { role, status },
        })
      })
      return db.one(
        'SELECT id, name, email, role, status, auth_version, created_at FROM users WHERE id = ?',
        [userId],
      )
    },

    async listSubjects(filters = {}) {
      const statusClause =
        filters.status && filters.status !== 'all' ? 'WHERE subjects.status = ?' : ''
      const params = statusClause ? [filters.status] : []
      return db.many(
        `SELECT subjects.*,
           (SELECT COUNT(*) FROM chapters WHERE chapters.subject_id = subjects.id) AS chapter_count,
           (SELECT COUNT(*) FROM course_classes WHERE course_classes.subject_id = subjects.id) AS class_count
         FROM subjects
         ${statusClause}
         ORDER BY subjects.name`,
        params,
      )
    },

    async createSubject(input, actorId) {
      const id = createId('subject')
      const name = String(input.name ?? '').trim()
      const credits = Number(input.credits)
      if (!name || !Number.isInteger(credits) || credits <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Tên môn và số tín chỉ không hợp lệ.')
      }
      await db.execute(
        "INSERT INTO subjects (id, name, credits, status) VALUES (?, ?, ?, 'active')",
        [id, name, credits],
      )
      await writeAudit(db, actorId, 'admin.subject.created', 'subject', id, { name, credits })
      return requireEntity(db, 'subjects', id, 'môn học')
    },

    async updateSubject(subjectId, input, actorId) {
      const subject = await requireEntity(db, 'subjects', subjectId, 'môn học')
      const name = String(input.name ?? subject.name).trim()
      const credits = Number(input.credits ?? subject.credits)
      const status = input.status ?? subject.status
      assertEnum(status, ['active', 'archived'], 'Trạng thái')
      if (!name || !Number.isInteger(credits) || credits <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Tên môn và số tín chỉ không hợp lệ.')
      }
      await db.execute('UPDATE subjects SET name = ?, credits = ?, status = ? WHERE id = ?', [
        name,
        credits,
        status,
        subjectId,
      ])
      await writeAudit(db, actorId, 'admin.subject.updated', 'subject', subjectId, input)
      return requireEntity(db, 'subjects', subjectId, 'môn học')
    },

    async archiveSubject(subjectId, actorId) {
      return this.updateSubject(subjectId, { status: 'archived' }, actorId)
    },

    async listTerms() {
      return db.many('SELECT * FROM academic_terms ORDER BY starts_at DESC, code DESC')
    },

    async createTerm(input, actorId) {
      const code = String(input.code ?? '').trim()
      const name = String(input.name ?? '').trim()
      const status = input.status ?? 'upcoming'
      assertEnum(status, ['upcoming', 'active', 'completed', 'archived'], 'Trạng thái')
      if (!code || !name) throw new ApiError(400, 'VALIDATION', 'Mã và tên học kỳ là bắt buộc.')
      if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
        throw new ApiError(400, 'VALIDATION', 'Ngày bắt đầu phải trước ngày kết thúc.')
      }
      const id = createId('term')
      await db.execute(
        `INSERT INTO academic_terms (id, code, name, starts_at, ends_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, code, name, input.startsAt ?? null, input.endsAt ?? null, status],
      )
      await writeAudit(db, actorId, 'admin.term.created', 'academic_term', id, { code, name })
      return requireEntity(db, 'academic_terms', id, 'học kỳ')
    },

    async updateTerm(termId, input, actorId) {
      const term = await requireEntity(db, 'academic_terms', termId, 'học kỳ')
      const next = {
        code: String(input.code ?? term.code).trim(),
        name: String(input.name ?? term.name).trim(),
        startsAt: input.startsAt === undefined ? term.starts_at : input.startsAt,
        endsAt: input.endsAt === undefined ? term.ends_at : input.endsAt,
        status: input.status ?? term.status,
      }
      assertEnum(next.status, ['upcoming', 'active', 'completed', 'archived'], 'Trạng thái')
      if (
        !next.code ||
        !next.name ||
        (next.startsAt && next.endsAt && next.startsAt > next.endsAt)
      ) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu học kỳ không hợp lệ.')
      }
      await db.execute(
        'UPDATE academic_terms SET code = ?, name = ?, starts_at = ?, ends_at = ?, status = ? WHERE id = ?',
        [next.code, next.name, next.startsAt, next.endsAt, next.status, termId],
      )
      await writeAudit(db, actorId, 'admin.term.updated', 'academic_term', termId, input)
      return requireEntity(db, 'academic_terms', termId, 'học kỳ')
    },

    async listClasses(filters = {}) {
      const rows = await db.many(
        `SELECT course_classes.*, subjects.name AS subject_name,
           academic_terms.code AS term_code, academic_terms.name AS term_name,
           (SELECT COUNT(*) FROM enrollments WHERE class_id = course_classes.id) AS student_count,
           (SELECT COUNT(*) FROM class_lecturer_assignments WHERE class_id = course_classes.id AND status = 'active') AS lecturer_count,
           (SELECT COUNT(*) FROM questions WHERE class_id = course_classes.id AND status = 'unanswered') AS unanswered_count
         FROM course_classes
         JOIN subjects ON subjects.id = course_classes.subject_id
         LEFT JOIN academic_terms ON academic_terms.id = course_classes.academic_term_id
         ORDER BY academic_terms.starts_at DESC, subjects.name, course_classes.group_number`,
      )
      return rows
        .filter((row) => !filters.subjectId || row.subject_id === filters.subjectId)
        .filter((row) => !filters.termId || row.academic_term_id === filters.termId)
        .filter(
          (row) => !filters.status || filters.status === 'all' || row.status === filters.status,
        )
        .map(mapClass)
    },

    async createClass(input, actorId) {
      const subject = await requireEntity(db, 'subjects', input.subjectId, 'môn học')
      const term = await requireEntity(db, 'academic_terms', input.academicTermId, 'học kỳ')
      if (subject.status !== 'active' || term.status === 'archived') {
        throw new ApiError(409, 'INACTIVE_PARENT', 'Môn học hoặc học kỳ không còn hoạt động.')
      }
      const groupNumber = Number(input.groupNumber)
      const classCode = String(input.classCode ?? '').trim()
      const name = String(input.name ?? `${classCode} - ${subject.name}`).trim()
      if (!Number.isInteger(groupNumber) || groupNumber <= 0 || !classCode || !name) {
        throw new ApiError(400, 'VALIDATION', 'Số tổ, mã lớp và tên lớp không hợp lệ.')
      }
      const id = createId('class')
      await db.execute(
        `INSERT INTO course_classes
         (id, subject_id, name, semester, academic_term_id, group_number, class_code, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [id, subject.id, name, term.code, term.id, groupNumber, classCode],
      )
      await writeAudit(db, actorId, 'admin.class.created', 'course_class', id, {
        subjectId: subject.id,
        academicTermId: term.id,
        groupNumber,
      })
      return (await this.listClasses()).find((item) => item.id === id)
    },

    async updateClass(classId, input, actorId) {
      const courseClass = await requireEntity(db, 'course_classes', classId, 'lớp tín chỉ')
      const subjectId = input.subjectId ?? courseClass.subject_id
      const termId = input.academicTermId ?? courseClass.academic_term_id
      const subject = await requireEntity(db, 'subjects', subjectId, 'môn học')
      const term = await requireEntity(db, 'academic_terms', termId, 'học kỳ')
      const groupNumber = Number(input.groupNumber ?? courseClass.group_number)
      const classCode = String(input.classCode ?? courseClass.class_code).trim()
      const name = String(input.name ?? courseClass.name).trim()
      const status = input.status ?? courseClass.status
      assertEnum(status, ['active', 'completed', 'archived'], 'Trạng thái')
      if (!Number.isInteger(groupNumber) || groupNumber <= 0 || !classCode || !name) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu lớp tín chỉ không hợp lệ.')
      }
      await db.execute(
        `UPDATE course_classes SET subject_id = ?, name = ?, semester = ?, academic_term_id = ?,
         group_number = ?, class_code = ?, status = ? WHERE id = ?`,
        [subject.id, name, term.code, term.id, groupNumber, classCode, status, classId],
      )
      await writeAudit(db, actorId, 'admin.class.updated', 'course_class', classId, input)
      return (await this.listClasses()).find((item) => item.id === classId)
    },

    async archiveClass(classId, actorId) {
      return this.updateClass(classId, { status: 'archived' }, actorId)
    },

    async listClassLecturers(classId) {
      await requireEntity(db, 'course_classes', classId, 'lớp tín chỉ')
      return db.many(
        `SELECT class_lecturer_assignments.*, users.name, users.email, users.status AS user_status
         FROM class_lecturer_assignments
         JOIN users ON users.id = class_lecturer_assignments.lecturer_id
         WHERE class_lecturer_assignments.class_id = ?
         ORDER BY class_lecturer_assignments.status, CASE WHEN assignment_role = 'lead' THEN 0 ELSE 1 END, users.name`,
        [classId],
      )
    },

    async assignLecturer(classId, input, actorId) {
      const courseClass = await requireEntity(db, 'course_classes', classId, 'lớp tín chỉ')
      const lecturer = await requireEntity(db, 'users', input.lecturerId, 'giảng viên')
      const assignmentRole = input.assignmentRole ?? 'lecturer'
      assertEnum(assignmentRole, ['lead', 'lecturer'], 'Vai trò phân công')
      if (
        courseClass.status !== 'active' ||
        lecturer.role !== 'lecturer' ||
        lecturer.status !== 'active'
      ) {
        throw new ApiError(
          409,
          'INACTIVE_ASSIGNMENT_TARGET',
          'Lớp hoặc tài khoản giảng viên không hợp lệ.',
        )
      }
      if (assignmentRole === 'lead') {
        const lead = await db.one(
          "SELECT lecturer_id FROM class_lecturer_assignments WHERE class_id = ? AND assignment_role = 'lead' AND status = 'active'",
          [classId],
        )
        if (lead && lead.lecturer_id !== lecturer.id) {
          throw new ApiError(409, 'ACTIVE_LEAD_EXISTS', 'Lớp đã có giảng viên phụ trách chính.')
        }
      }
      const existing = await db.one(
        'SELECT id FROM class_lecturer_assignments WHERE class_id = ? AND lecturer_id = ?',
        [classId, lecturer.id],
      )
      const id = existing?.id ?? createId('assignment')
      if (existing) {
        await db.execute(
          `UPDATE class_lecturer_assignments SET assignment_role = ?, status = 'active',
           assigned_by = ?, assigned_at = ?, ended_at = NULL WHERE id = ?`,
          [assignmentRole, actorId, nowIso(), id],
        )
      } else {
        await db.execute(
          `INSERT INTO class_lecturer_assignments
           (id, class_id, lecturer_id, assignment_role, status, assigned_by, assigned_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?)`,
          [id, classId, lecturer.id, assignmentRole, actorId, nowIso()],
        )
      }
      await writeAudit(db, actorId, 'admin.class.lecturer_assigned', 'course_class', classId, {
        lecturerId: lecturer.id,
        assignmentRole,
      })
      return (await this.listClassLecturers(classId)).find((item) => item.id === id)
    },

    async updateLecturerAssignment(classId, lecturerId, input, actorId) {
      const assignment = await db.one(
        'SELECT * FROM class_lecturer_assignments WHERE class_id = ? AND lecturer_id = ?',
        [classId, lecturerId],
      )
      if (!assignment) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phân công.')
      const assignmentRole = input.assignmentRole ?? assignment.assignment_role
      assertEnum(assignmentRole, ['lead', 'lecturer'], 'Vai trò phân công')
      if (assignmentRole === 'lead' && assignment.assignment_role !== 'lead') {
        const lead = await db.one(
          "SELECT lecturer_id FROM class_lecturer_assignments WHERE class_id = ? AND assignment_role = 'lead' AND status = 'active'",
          [classId],
        )
        if (lead)
          throw new ApiError(409, 'ACTIVE_LEAD_EXISTS', 'Lớp đã có giảng viên phụ trách chính.')
      }
      await db.execute('UPDATE class_lecturer_assignments SET assignment_role = ? WHERE id = ?', [
        assignmentRole,
        assignment.id,
      ])
      await writeAudit(db, actorId, 'admin.class.lecturer_updated', 'course_class', classId, {
        lecturerId,
        assignmentRole,
      })
      return (await this.listClassLecturers(classId)).find((item) => item.id === assignment.id)
    },

    async endLecturerAssignment(classId, lecturerId, actorId) {
      const assignment = await db.one(
        "SELECT * FROM class_lecturer_assignments WHERE class_id = ? AND lecturer_id = ? AND status = 'active'",
        [classId, lecturerId],
      )
      if (!assignment)
        throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy phân công đang hoạt động.')
      await db.transaction(async (transaction) => {
        await transaction.execute(
          "UPDATE class_lecturer_assignments SET status = 'inactive', ended_at = ? WHERE id = ?",
          [nowIso(), assignment.id],
        )
        await transaction.execute(
          `UPDATE questions SET claimed_by = NULL, claimed_at = NULL, routing_status = 'queued',
           row_version = row_version + 1, updated_at = ?
           WHERE class_id = ? AND claimed_by = ? AND status = 'unanswered'`,
          [nowIso(), classId, lecturerId],
        )
        await writeAudit(
          transaction,
          actorId,
          'admin.class.lecturer_ended',
          'course_class',
          classId,
          {
            lecturerId,
          },
        )
      })
      return { id: assignment.id, classId, lecturerId, status: 'inactive' }
    },

    async listChapters(subjectId) {
      await requireEntity(db, 'subjects', subjectId, 'môn học')
      return db.many(
        `SELECT chapters.*,
           (SELECT COUNT(*) FROM lessons WHERE lessons.chapter_id = chapters.id) AS lesson_count
         FROM chapters WHERE subject_id = ? ORDER BY chapter_order`,
        [subjectId],
      )
    },

    async createChapter(subjectId, input, actorId) {
      await requireEntity(db, 'subjects', subjectId, 'môn học')
      const title = String(input.title ?? '').trim()
      const order = Number(input.order)
      if (!title || !Number.isInteger(order) || order <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Tên và thứ tự chương không hợp lệ.')
      }
      const id = createId('chapter')
      await db.execute(
        'INSERT INTO chapters (id, subject_id, chapter_order, title) VALUES (?, ?, ?, ?)',
        [id, subjectId, order, title],
      )
      await writeAudit(db, actorId, 'admin.chapter.created', 'chapter', id, { subjectId, order })
      return requireEntity(db, 'chapters', id, 'chương')
    },

    async updateChapter(chapterId, input, actorId) {
      const chapter = await requireEntity(db, 'chapters', chapterId, 'chương')
      const title = String(input.title ?? chapter.title).trim()
      const order = Number(input.order ?? chapter.chapter_order)
      if (!title || !Number.isInteger(order) || order <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu chương không hợp lệ.')
      }
      await db.execute('UPDATE chapters SET chapter_order = ?, title = ? WHERE id = ?', [
        order,
        title,
        chapterId,
      ])
      await writeAudit(db, actorId, 'admin.chapter.updated', 'chapter', chapterId, input)
      return requireEntity(db, 'chapters', chapterId, 'chương')
    },

    async deleteChapter(chapterId, actorId) {
      await requireEntity(db, 'chapters', chapterId, 'chương')
      const dependencies = await db.one(
        'SELECT COUNT(*) AS count FROM lessons WHERE chapter_id = ?',
        [chapterId],
      )
      if (Number(dependencies.count) > 0) {
        throw new ApiError(409, 'CHAPTER_NOT_EMPTY', 'Cần xóa hoặc chuyển các bài học trước.')
      }
      await db.execute('DELETE FROM chapters WHERE id = ?', [chapterId])
      await writeAudit(db, actorId, 'admin.chapter.deleted', 'chapter', chapterId)
      return { id: chapterId, deleted: true }
    },

    async listLessons(chapterId) {
      await requireEntity(db, 'chapters', chapterId, 'chương')
      return db.many('SELECT * FROM lessons WHERE chapter_id = ? ORDER BY lesson_order', [
        chapterId,
      ])
    },

    async createLesson(chapterId, input, actorId) {
      await requireEntity(db, 'chapters', chapterId, 'chương')
      const title = String(input.title ?? '').trim()
      const contentHtml = String(input.contentHtml ?? '').trim()
      const order = Number(input.order)
      if (!title || !contentHtml || !Number.isInteger(order) || order <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu bài học không hợp lệ.')
      }
      const id = createId('lesson')
      await db.execute(
        `INSERT INTO lessons (id, chapter_id, lesson_order, title, content_html)
         VALUES (?, ?, ?, ?, ?)`,
        [id, chapterId, order, title, contentHtml],
      )
      await writeAudit(db, actorId, 'admin.lesson.created', 'lesson', id, { chapterId, order })
      return requireEntity(db, 'lessons', id, 'bài học')
    },

    async updateLesson(lessonId, input, actorId) {
      const lesson = await requireEntity(db, 'lessons', lessonId, 'bài học')
      const title = String(input.title ?? lesson.title).trim()
      const contentHtml = String(input.contentHtml ?? lesson.content_html).trim()
      const order = Number(input.order ?? lesson.lesson_order)
      if (!title || !contentHtml || !Number.isInteger(order) || order <= 0) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu bài học không hợp lệ.')
      }
      await db.execute(
        'UPDATE lessons SET lesson_order = ?, title = ?, content_html = ? WHERE id = ?',
        [order, title, contentHtml, lessonId],
      )
      await writeAudit(db, actorId, 'admin.lesson.updated', 'lesson', lessonId, input)
      return requireEntity(db, 'lessons', lessonId, 'bài học')
    },

    async deleteLesson(lessonId, actorId) {
      await requireEntity(db, 'lessons', lessonId, 'bài học')
      const dependencies = await db.one(
        `SELECT
           (SELECT COUNT(*) FROM class_lessons WHERE lesson_id = ?) +
           (SELECT COUNT(*) FROM questions WHERE lesson_id = ?) +
           (SELECT COUNT(*) FROM practice_questions WHERE lesson_id = ?) AS count`,
        [lessonId, lessonId, lessonId],
      )
      if (Number(dependencies.count) > 0) {
        throw new ApiError(409, 'LESSON_IN_USE', 'Bài học đang được sử dụng nên không thể xóa.')
      }
      await db.execute('DELETE FROM lessons WHERE id = ?', [lessonId])
      await writeAudit(db, actorId, 'admin.lesson.deleted', 'lesson', lessonId)
      return { id: lessonId, deleted: true }
    },

    async listMaterials(subjectId) {
      await requireEntity(db, 'subjects', subjectId, 'môn học')
      return db.many(
        `SELECT materials.*,
           (SELECT COUNT(*) FROM material_versions WHERE material_id = materials.id) AS version_count
         FROM materials WHERE subject_id = ? ORDER BY title`,
        [subjectId],
      )
    },

    async createMaterial(subjectId, input, actorId) {
      await requireEntity(db, 'subjects', subjectId, 'môn học')
      const title = String(input.title ?? '').trim()
      const type = String(input.type ?? '').trim()
      const author = String(input.author ?? '').trim()
      if (!title || !type || !author)
        throw new ApiError(400, 'VALIDATION', 'Thiếu thông tin học liệu.')
      const id = createId('material')
      await db.execute(
        `INSERT INTO materials (id, subject_id, title, type, author, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, subjectId, title, type, author, actorId, nowIso()],
      )
      await writeAudit(db, actorId, 'admin.material.created', 'material', id, { subjectId })
      return requireEntity(db, 'materials', id, 'học liệu')
    },

    async updateMaterial(materialId, input, actorId) {
      const material = await requireEntity(db, 'materials', materialId, 'học liệu')
      const title = String(input.title ?? material.title).trim()
      const type = String(input.type ?? material.type).trim()
      const author = String(input.author ?? material.author).trim()
      if (!title || !type || !author) {
        throw new ApiError(400, 'VALIDATION', 'Dữ liệu học liệu không hợp lệ.')
      }
      await db.execute('UPDATE materials SET title = ?, type = ?, author = ? WHERE id = ?', [
        title,
        type,
        author,
        materialId,
      ])
      await writeAudit(db, actorId, 'admin.material.updated', 'material', materialId, input)
      return requireEntity(db, 'materials', materialId, 'học liệu')
    },

    async deleteMaterial(materialId, actorId) {
      await requireEntity(db, 'materials', materialId, 'học liệu')
      const dependencies = await db.one(
        `SELECT
           (SELECT COUNT(*) FROM class_materials WHERE material_id = ?) +
           (SELECT COUNT(*) FROM rag_citations WHERE material_id = ?) +
           (SELECT COUNT(*) FROM mock_responses WHERE material_id = ?) AS count`,
        [materialId, materialId, materialId],
      )
      if (Number(dependencies.count) > 0) {
        throw new ApiError(409, 'MATERIAL_IN_USE', 'Học liệu đang được sử dụng nên không thể xóa.')
      }
      await db.execute('DELETE FROM materials WHERE id = ?', [materialId])
      await writeAudit(db, actorId, 'admin.material.deleted', 'material', materialId)
      return { id: materialId, deleted: true }
    },

    async createMaterialVersion(materialId, input, actorId) {
      await requireEntity(db, 'materials', materialId, 'học liệu')
      const year = Number(input.year)
      const fileUrl = String(input.fileUrl ?? '').trim()
      if (!Number.isInteger(year) || year < 1900 || !fileUrl) {
        throw new ApiError(400, 'VALIDATION', 'Năm và đường dẫn tệp không hợp lệ.')
      }
      const id = createId('material_version')
      await db.execute(
        `INSERT INTO material_versions (id, material_id, year, file_url, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, materialId, year, fileUrl, actorId, nowIso()],
      )
      await writeAudit(db, actorId, 'admin.material.version_created', 'material', materialId, {
        versionId: id,
        year,
      })
      return requireEntity(db, 'material_versions', id, 'phiên bản học liệu')
    },

    async listSharedQuestions(filters = {}) {
      const rows = await db.many(
        `SELECT practice_questions.*, subjects.name AS subject_name, chapters.title AS chapter_title
         FROM practice_questions
         JOIN subjects ON subjects.id = practice_questions.subject_id
         JOIN chapters ON chapters.id = practice_questions.chapter_id
         WHERE practice_questions.scope = 'subject_shared'
         ORDER BY practice_questions.updated_at DESC`,
      )
      const filtered = rows
        .filter((row) => !filters.subjectId || row.subject_id === filters.subjectId)
        .filter(
          (row) => !filters.status || filters.status === 'all' || row.status === filters.status,
        )
      return Promise.all(
        filtered.map(async (row) =>
          mapPracticeQuestion(
            row,
            await db.many(
              'SELECT * FROM practice_question_options WHERE question_id = ? ORDER BY option_order',
              [row.id],
            ),
          ),
        ),
      )
    },

    async createSharedQuestion(input, actorId) {
      const chapter = await requireEntity(db, 'chapters', input.chapterId, 'chương')
      if (chapter.subject_id !== input.subjectId) {
        throw new ApiError(400, 'VALIDATION', 'Chương không thuộc môn học đã chọn.')
      }
      const options = Array.isArray(input.options) ? input.options : []
      const keys = options.map((option) => option.key)
      if (
        !String(input.content ?? '').trim() ||
        !String(input.explanation ?? '').trim() ||
        options.length !== 4 ||
        new Set(keys).size !== 4 ||
        !keys.includes(input.correctOptionKey)
      ) {
        throw new ApiError(
          400,
          'VALIDATION',
          'Câu hỏi phải có nội dung, giải thích và 4 đáp án hợp lệ.',
        )
      }
      const id = createId('practice_question')
      const timestamp = nowIso()
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `INSERT INTO practice_questions
           (id, subject_id, chapter_id, lesson_id, content, explanation, difficulty, status,
            source_type, scope, created_by, published_by, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'medium', ?, 'manual', 'subject_shared', ?, ?, ?, ?, ?)`,
          [
            id,
            input.subjectId,
            input.chapterId,
            input.lessonId ?? null,
            String(input.content).trim(),
            String(input.explanation).trim(),
            input.status === 'draft' ? 'draft' : 'published',
            actorId,
            input.status === 'draft' ? null : actorId,
            input.status === 'draft' ? null : timestamp,
            timestamp,
            timestamp,
          ],
        )
        for (const [index, option] of options.entries()) {
          await transaction.execute(
            `INSERT INTO practice_question_options
             (id, question_id, option_key, content, is_correct, option_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              createId('practice_option'),
              id,
              option.key,
              String(option.content ?? '').trim(),
              option.key === input.correctOptionKey ? 1 : 0,
              index + 1,
            ],
          )
        }
        await writeAudit(
          transaction,
          actorId,
          'admin.practice_question.created',
          'practice_question',
          id,
          {
            subjectId: input.subjectId,
            scope: 'subject_shared',
          },
        )
      })
      return (await this.listSharedQuestions()).find((item) => item.id === id)
    },

    async updateSharedQuestion(questionId, input, actorId) {
      const question = await requireEntity(db, 'practice_questions', questionId, 'câu hỏi')
      if (question.scope !== 'subject_shared') {
        throw new ApiError(
          403,
          'NOT_SHARED_QUESTION',
          'Câu hỏi này thuộc ngân hàng riêng của giảng viên.',
        )
      }
      const chapter = await requireEntity(db, 'chapters', input.chapterId, 'chương')
      if (chapter.subject_id !== input.subjectId) {
        throw new ApiError(400, 'VALIDATION', 'Chương không thuộc môn học đã chọn.')
      }
      const options = Array.isArray(input.options) ? input.options : []
      const keys = options.map((option) => option.key)
      if (
        !String(input.content ?? '').trim() ||
        !String(input.explanation ?? '').trim() ||
        options.length !== 4 ||
        new Set(keys).size !== 4 ||
        !keys.includes(input.correctOptionKey)
      ) {
        throw new ApiError(
          400,
          'VALIDATION',
          'Câu hỏi phải có nội dung, giải thích và 4 đáp án hợp lệ.',
        )
      }
      const timestamp = nowIso()
      await db.transaction(async (transaction) => {
        await transaction.execute(
          `UPDATE practice_questions SET subject_id = ?, chapter_id = ?, lesson_id = ?,
           content = ?, explanation = ?, status = ?, published_by = ?, published_at = ?, updated_at = ?
           WHERE id = ?`,
          [
            input.subjectId,
            input.chapterId,
            input.lessonId ?? null,
            String(input.content).trim(),
            String(input.explanation).trim(),
            input.status === 'draft' ? 'draft' : 'published',
            input.status === 'draft' ? null : actorId,
            input.status === 'draft' ? null : timestamp,
            timestamp,
            questionId,
          ],
        )
        await transaction.execute('DELETE FROM practice_question_options WHERE question_id = ?', [
          questionId,
        ])
        for (const [index, option] of options.entries()) {
          await transaction.execute(
            `INSERT INTO practice_question_options
             (id, question_id, option_key, content, is_correct, option_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              createId('practice_option'),
              questionId,
              option.key,
              String(option.content ?? '').trim(),
              option.key === input.correctOptionKey ? 1 : 0,
              index + 1,
            ],
          )
        }
        await writeAudit(
          transaction,
          actorId,
          'admin.practice_question.updated',
          'practice_question',
          questionId,
        )
      })
      return (await this.listSharedQuestions()).find((item) => item.id === questionId)
    },

    async archiveSharedQuestion(questionId, actorId) {
      const question = await requireEntity(db, 'practice_questions', questionId, 'câu hỏi')
      if (question.scope !== 'subject_shared') {
        throw new ApiError(
          403,
          'NOT_SHARED_QUESTION',
          'Câu hỏi này không thuộc ngân hàng dùng chung.',
        )
      }
      await db.execute(
        "UPDATE practice_questions SET status = 'archived', updated_at = ? WHERE id = ?",
        [nowIso(), questionId],
      )
      await writeAudit(
        db,
        actorId,
        'admin.practice_question.archived',
        'practice_question',
        questionId,
      )
      return (await this.listSharedQuestions()).find((item) => item.id === questionId)
    },

    async listUnroutedQuestions() {
      return db.many(
        `SELECT questions.*, users.name AS student_name, users.email AS student_email,
           subjects.name AS subject_name
         FROM questions
         JOIN users ON users.id = questions.student_id
         JOIN subjects ON subjects.id = questions.subject_id
         WHERE questions.class_id IS NULL OR questions.routing_status = 'unrouted'
         ORDER BY questions.created_at`,
      )
    },

    async routeQuestion(questionId, classId, actorId) {
      const question = await requireEntity(db, 'questions', questionId, 'câu hỏi')
      const courseClass = await requireEntity(db, 'course_classes', classId, 'lớp tín chỉ')
      if (question.subject_id !== courseClass.subject_id) {
        throw new ApiError(400, 'SUBJECT_MISMATCH', 'Câu hỏi và lớp tín chỉ không cùng môn.')
      }
      const enrollment = await db.one(
        'SELECT id FROM enrollments WHERE class_id = ? AND student_id = ?',
        [classId, question.student_id],
      )
      if (!enrollment) {
        throw new ApiError(
          409,
          'STUDENT_NOT_ENROLLED',
          'Sinh viên không thuộc lớp tín chỉ đã chọn.',
        )
      }
      await db.execute(
        `UPDATE questions SET class_id = ?, routing_status = 'queued', claimed_by = NULL,
         claimed_at = NULL, row_version = row_version + 1, updated_at = ? WHERE id = ?`,
        [classId, nowIso(), questionId],
      )
      await writeAudit(db, actorId, 'admin.question.routed', 'question', questionId, { classId })
      return requireEntity(db, 'questions', questionId, 'câu hỏi')
    },

    async listAuditLogs(limit = 100) {
      return (
        await db.many(
          `SELECT audit_logs.*, users.name AS actor_name, users.email AS actor_email, users.role AS actor_role
           FROM audit_logs LEFT JOIN users ON users.id = audit_logs.actor_id
           ORDER BY audit_logs.created_at DESC LIMIT ?`,
          [Math.min(Math.max(Number(limit) || 100, 1), 500)],
        )
      ).map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: parseMetadata(row.metadata_json),
        createdAt: row.created_at,
        actor: row.actor_id
          ? { id: row.actor_id, name: row.actor_name, email: row.actor_email, role: row.actor_role }
          : null,
      }))
    },
  }
}
