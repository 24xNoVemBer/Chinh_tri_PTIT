import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminClassesPage() {
  const loader = useCallback(async () => {
    const [classes, subjects, terms, users] = await Promise.all([
      adminRepository.listClasses(),
      adminRepository.listSubjects({ status: 'active' }),
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
  async function selectClass(classId) {
    setSelectedClassId(classId)
    try {
      setAssignments(await adminRepository.listClassLecturers(classId))
    } catch (cause) {
      setFeedback(cause.message)
    }
  }
  async function submit(action, success) {
    try {
      await action()
      setFeedback(success)
      reload()
      if (selectedClassId) setAssignments(await adminRepository.listClassLecturers(selectedClassId))
    } catch (cause) {
      setFeedback(cause.message)
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
        <p className="admin-feedback" role="status">
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
                  <tr key={item.id}>
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
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => selectClass(item.id)}
                      >
                        Phân công
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            submit(
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
            event.currentTarget.reset()
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
            <button className="button button--primary" type="submit">
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
                  <button
                    className="button button--ghost"
                    type="button"
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
                )}
              </li>
            ))}
          </ul>
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              submit(
                () =>
                  adminRepository.assignLecturer(selectedClassId, {
                    lecturerId: form.get('lecturerId'),
                    assignmentRole: form.get('assignmentRole'),
                  }),
                'Đã phân công giảng viên.',
              )
            }}
          >
            <div className="admin-form__row">
              <div className="admin-field">
                <label htmlFor="assignment-lecturer">Giảng viên</label>
                <select id="assignment-lecturer" name="lecturerId" required>
                  <option value="">Chọn giảng viên</option>
                  {data.lecturers.map((lecturer) => (
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
              <button className="button button--secondary" type="submit">
                Thêm phân công
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
