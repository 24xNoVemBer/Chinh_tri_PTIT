import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import './AdminPage.css'

export default function AdminOperationsPage() {
  const loader = useCallback(async () => {
    const [questions, routedQuestions, classes, auditLogs] = await Promise.all([
      adminRepository.listUnroutedQuestions(),
      adminRepository.listRoutedQuestions(),
      adminRepository.listClasses({ status: 'active' }),
      adminRepository.listAuditLogs(100),
    ])
    const lecturerEntries = await Promise.all(
      classes.map(async (courseClass) => [
        courseClass.id,
        (await adminRepository.listClassLecturers(courseClass.id)).filter(
          (assignment) => assignment.status === 'active' && assignment.user_status === 'active',
        ),
      ]),
    )
    return {
      questions,
      routedQuestions,
      classes,
      auditLogs,
      lecturersByClass: Object.fromEntries(lecturerEntries),
    }
  }, [])
  const { data, loading, error, reload } = useAsyncData(loader)
  const [selections, setSelections] = useState({})
  const [assigneeSelections, setAssigneeSelections] = useState({})
  const [busyQuestionId, setBusyQuestionId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  async function route(question) {
    if (busyQuestionId) return
    const classId = selections[question.id]
    if (!classId) {
      setFeedback('Hãy chọn lớp tín chỉ phù hợp.')
      setFeedbackError(true)
      return
    }
    setBusyQuestionId(question.id)
    setFeedback('')
    setFeedbackError(false)
    try {
      await adminRepository.routeQuestion(question.id, classId)
      setFeedback('Đã điều phối câu hỏi.')
      setSelections((current) => {
        const next = { ...current }
        delete next[question.id]
        return next
      })
      await reload()
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể điều phối câu hỏi.')
      setFeedbackError(true)
    } finally {
      setBusyQuestionId('')
    }
  }
  async function reassign(question) {
    if (busyQuestionId) return
    const lecturerId = assigneeSelections[question.id]
    if (!lecturerId) {
      setFeedback('Hãy chọn giảng viên thuộc lớp tín chỉ này.')
      setFeedbackError(true)
      return
    }
    setBusyQuestionId(question.id)
    setFeedback('')
    setFeedbackError(false)
    try {
      await adminRepository.reassignQuestion(question.id, lecturerId)
      setFeedback('Đã chuyển người xử lý câu hỏi.')
      setAssigneeSelections((current) => {
        const next = { ...current }
        delete next[question.id]
        return next
      })
      await reload()
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể chuyển người xử lý câu hỏi.')
      setFeedbackError(true)
    } finally {
      setBusyQuestionId('')
    }
  }
  if (loading) return <LoadingState label="Đang tải dữ liệu vận hành…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Giám sát</p>
          <h1>Vận hành & nhật ký</h1>
          <p>Xử lý câu hỏi chưa xác định lớp và kiểm tra các thay đổi quản trị gần đây.</p>
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
      <section className="admin-panel">
        <div className="admin-panel__header">
          <div>
            <h2>Câu hỏi chưa điều phối</h2>
            <p>{data.questions.length} câu cần xác định lớp tín chỉ.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Câu hỏi</th>
                <th scope="col">Lớp đích</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.questions.map((question) => (
                <tr key={question.id}>
                  <td>
                    <strong>{question.content}</strong>
                    <small>
                      {question.student_name} · {question.subject_name}
                    </small>
                  </td>
                  <td>
                    <select
                      aria-label={`Lớp đích cho câu hỏi ${question.id}`}
                      value={selections[question.id] ?? ''}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn lớp</option>
                      {data.classes
                        .filter((item) => item.subjectId === question.subject_id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.classCode} · Tổ {item.groupNumber}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={Boolean(busyQuestionId)}
                      onClick={() => route(question)}
                    >
                      {busyQuestionId === question.id ? 'Đang điều phối…' : 'Điều phối'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.questions.length && <p className="admin-empty">Không có câu hỏi chờ điều phối.</p>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel__header">
          <div>
            <h2>Điều phối người xử lý</h2>
            <p>{data.routedQuestions.length} câu chưa trả lời trong các hàng đợi lớp.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Câu hỏi</th>
                <th scope="col">Lớp</th>
                <th scope="col">Người xử lý hiện tại</th>
                <th scope="col">Chuyển cho</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.routedQuestions.map((question) => (
                <tr key={question.id}>
                  <td>
                    <strong>{question.content}</strong>
                    <small>{question.student_name}</small>
                  </td>
                  <td>
                    <strong>{question.class_code}</strong>
                    <small>Tổ {question.group_number}</small>
                  </td>
                  <td>
                    {question.claimed_by_name ? (
                      <>
                        <strong>{question.claimed_by_name}</strong>
                        <small>{question.claimed_by_email}</small>
                      </>
                    ) : (
                      <span className="admin-status admin-status--muted">Chưa có người nhận</span>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={`Người xử lý mới cho câu hỏi ${question.id}`}
                      value={assigneeSelections[question.id] ?? ''}
                      onChange={(event) =>
                        setAssigneeSelections((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn giảng viên</option>
                      {(data.lecturersByClass[question.class_id] ?? []).map((assignment) => (
                        <option key={assignment.id} value={assignment.lecturer_id}>
                          {assignment.name}
                          {assignment.assignment_role === 'lead' ? ' · Phụ trách chính' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={Boolean(busyQuestionId)}
                      onClick={() => reassign(question)}
                    >
                      {busyQuestionId === question.id ? 'Đang chuyển…' : 'Chuyển xử lý'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.routedQuestions.length && (
          <p className="admin-empty">Không có câu hỏi nào cần điều phối người xử lý.</p>
        )}
      </section>
      <section className="admin-panel">
        <div className="admin-panel__header">
          <div>
            <h2>Nhật ký quản trị</h2>
            <p>100 sự kiện gần nhất.</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Người thực hiện</th>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>
                    <strong>{entry.actor?.name ?? 'Hệ thống'}</strong>
                    <small>{entry.actor?.email}</small>
                  </td>
                  <td>{entry.action}</td>
                  <td>
                    {entry.entityType} · {entry.entityId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
