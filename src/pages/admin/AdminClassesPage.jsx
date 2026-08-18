import { Fragment, useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminClassesPage() {
  const loader = useCallback(async () => {
    const [classes, subjects, terms, users] = await Promise.all([
      adminRepository.listClasses(),
      adminRepository.listSubjects(),
      adminRepository.listTerms(),
      adminRepository.listUsers({ role: 'lecturer', status: 'active' }),
    ])
    return {
      classes,
      subjects,
      terms,
      lecturers: users.filter((user) => user.role === 'lecturer' && user.status === 'active'),
    }
  }, [])
  const { data, loading, error, reload } = useAsyncData(loader)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingClassId, setEditingClassId] = useState('')
  async function selectClass(classId) {
    setSelectedClassId(classId)
    setFeedback('')
    setFeedbackError(false)
    try {
      setAssignments(await adminRepository.listClassLecturers(classId))
    } catch (cause) {
      setAssignments([])
      setFeedback(cause.message ?? 'Không thể tải danh sách phân công.')
      setFeedbackError(true)
    }
  }
  async function submit(action, success) {
    if (busy) return false
    setBusy(true)
    setFeedback('')
    setFeedbackError(false)
    try {
      await action()
      setFeedback(success)
      await reload()
      if (selectedClassId) setAssignments(await adminRepository.listClassLecturers(selectedClassId))
      return true
    } catch (cause) {
      setFeedback(cause.message)
      setFeedbackError(true)
      return false
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <LoadingState label="Đang tải lớp tín chỉ…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Tổ học tập</p>
          <h1>Lớp tín chỉ & phân công</h1>
          <p>Mỗi lớp có thể có nhiều giảng viên, trong đó tối đa một người phụ trách chính.</p>
        </div>
      </header>
      {feedback && (
        <p
          className={`admin-feedback ${feedbackError ? 'admin-feedback--error' : ''}`}
          role={feedbackError ? 'alert' : 'status'}
        >
          {feedback}
        </p>
      )}
      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Danh sách lớp</h2>
              <p>{data.classes.length} lớp tín chỉ.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Lớp</th>
                  <th scope="col">Học kỳ</th>
                  <th scope="col">Quy mô</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.classes.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td>
                        <strong>
                          {item.classCode} · Tổ {item.groupNumber}
                        </strong>
                        <small>{item.subjectName}</small>
                      </td>
                      <td>{item.termCode || item.semester}</td>
                      <td>
                        {item.studentCount} SV · {item.lecturerCount} GV
                      </td>
                      <td>
                        <div className="admin-inline-actions">
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => selectClass(item.id)}
                          >
                            Phân công
                          </button>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() =>
                              setEditingClassId(editingClassId === item.id ? '' : item.id)
                            }
                          >
                            Sửa
                          </button>
                          {item.status !== 'archived' && (
                            <button
                              className="button button--ghost"
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                submit(
                                  () => adminRepository.archiveClass(item.id),
                                  'Đã lưu trữ lớp tín chỉ.',
                                )
                              }
                            >
                              Lưu trữ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingClassId === item.id && (
                      <tr>
                        <td colSpan="4">
                          <form
                            className="admin-inline-editor"
                            onSubmit={async (event) => {
                              event.preventDefault()
                              const formElement = event.currentTarget
                              const form = new FormData(formElement)
                              const saved = await submit(
                                () =>
                                  adminRepository.updateClass(item.id, {
                                    subjectId: form.get('subjectId'),
                                    academicTermId: form.get('termId'),
                                    classCode: form.get('classCode'),
                                    groupNumber: Number(form.get('groupNumber')),
                                    name: form.get('name'),
                                    status: form.get('status'),
                                  }),
                                'Đã cập nhật lớp tín chỉ.',
                              )
                              if (saved) setEditingClassId('')
                            }}
                          >
                            <select
                              name="subjectId"
                              defaultValue={item.subjectId}
                              aria-label="Môn học"
                            >
                              {data.subjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.name}
                                </option>
                              ))}
                            </select>
                            <select
                              name="termId"
                              defaultValue={item.academicTermId}
                              aria-label="Học kỳ"
                            >
                              {data.terms.map((term) => (
                                <option key={term.id} value={term.id}>
                                  {term.name}
                                </option>
                              ))}
                            </select>
                            <input
                              name="classCode"
                              defaultValue={item.classCode}
                              aria-label="Mã lớp"
                              required
                            />
                            <input
                              name="groupNumber"
                              type="number"
                              min="1"
                              defaultValue={item.groupNumber}
                              aria-label="Số tổ"
                              required
                            />
                            <input
                              name="name"
                              defaultValue={item.name}
                              aria-label="Tên hiển thị"
                              required
                            />
                            <select
                              name="status"
                              defaultValue={item.status}
                              aria-label="Trạng thái lớp"
                            >
                              <option value="active">Hoạt động</option>
                              <option value="completed">Hoàn thành</option>
                              <option value="archived">Lưu trữ</option>
                            </select>
                            <button
                              className="button button--secondary"
                              type="submit"
                              disabled={busy}
                            >
                              Lưu
                            </button>
                            <button
                              className="button button--ghost"
                              type="button"
                              onClick={() => setEditingClassId('')}
                            >
                              Hủy
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const formElement = event.currentTarget
            const form = new FormData(formElement)
            const saved = await submit(
              () =>
                adminRepository.createClass({
                  subjectId: form.get('subjectId'),
                  academicTermId: form.get('termId'),
                  groupNumber: Number(form.get('groupNumber')),
                  classCode: form.get('classCode'),
                  name: form.get('name'),
                }),
              'Đã tạo lớp tín chỉ.',
            )
            if (saved) formElement.reset()
          }}
        >
          <h2>Tạo lớp tín chỉ</h2>
          <div className="admin-field">
            <label htmlFor="class-subject">Môn học</label>
            <select id="class-subject" name="subjectId" required>
              <option value="">Chọn môn</option>
              {data.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="class-term">Học kỳ</label>
            <select id="class-term" name="termId" required>
              <option value="">Chọn học kỳ</option>
              {data.terms
                .filter((term) => term.status !== 'archived')
                .map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="admin-form__row">
            <div className="admin-field">
              <label htmlFor="class-code">Mã lớp</label>
              <input id="class-code" name="classCode" required />
            </div>
            <div className="admin-field">
              <label htmlFor="class-group">Số tổ</label>
              <input id="class-group" name="groupNumber" type="number" min="1" required />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="class-name">Tên hiển thị</label>
            <input id="class-name" name="name" />
          </div>
          <div className="admin-actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              Tạo lớp
            </button>
          </div>
        </form>
      </div>
      {selectedClassId && (
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h2>Phân công giảng viên</h2>
              <p>Các giảng viên cùng nhìn thấy hàng đợi của lớp.</p>
            </div>
          </div>
          <ul className="admin-list">
            {assignments.map((assignment) => (
              <li className="admin-list__item" key={assignment.id}>
                <div>
                  <strong>{assignment.name}</strong>
                  <small>
                    {assignment.email} ·{' '}
                    {assignment.assignment_role === 'lead' ? 'Phụ trách chính' : 'Giảng viên'}
                  </small>
                </div>
                {assignment.status === 'active' && (
                  <div className="admin-inline-actions">
                    <select
                      aria-label={`Vai trò phân công của ${assignment.name}`}
                      value={assignment.assignment_role}
                      disabled={busy}
                      onChange={(event) =>
                        submit(
                          () =>
                            adminRepository.updateLecturerAssignment(
                              selectedClassId,
                              assignment.lecturer_id,
                              { assignmentRole: event.target.value },
                            ),
                          'Đã cập nhật vai trò phân công.',
                        )
                      }
                    >
                      <option value="lecturer">Giảng viên</option>
                      <option value="lead">Phụ trách chính</option>
                    </select>
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        submit(
                          () =>
                            adminRepository.endLecturerAssignment(
                              selectedClassId,
                              assignment.lecturer_id,
                            ),
                          'Đã kết thúc phân công.',
                        )
                      }
                    >
                      Kết thúc
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault()
              const formElement = event.currentTarget
              const form = new FormData(formElement)
              const saved = await submit(
                () =>
                  adminRepository.assignLecturer(selectedClassId, {
                    lecturerId: form.get('lecturerId'),
                    assignmentRole: form.get('assignmentRole'),
                  }),
                'Đã phân công giảng viên.',
              )
              if (saved) formElement.reset()
            }}
          >
            <div className="admin-form__row">
              <div className="admin-field">
                <label htmlFor="assignment-lecturer">Giảng viên</label>
                <select id="assignment-lecturer" name="lecturerId" required>
                  <option value="">Chọn giảng viên</option>
                  {data.lecturers
                    .filter(
                      (lecturer) =>
                        !assignments.some(
                          (assignment) =>
                            assignment.lecturer_id === lecturer.id &&
                            assignment.status === 'active',
                        ),
                    )
                    .map((lecturer) => (
                      <option key={lecturer.id} value={lecturer.id}>
                        {lecturer.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="admin-field">
                <label htmlFor="assignment-role">Vai trò</label>
                <select id="assignment-role" name="assignmentRole">
                  <option value="lecturer">Giảng viên</option>
                  <option value="lead">Phụ trách chính</option>
                </select>
              </div>
            </div>
            <div className="admin-actions">
              <button className="button button--secondary" type="submit" disabled={busy}>
                Thêm phân công
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
