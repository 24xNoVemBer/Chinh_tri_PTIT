import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import './AdminPage.css'

export default function AdminOperationsPage() {
  const loader = useCallback(async () => {
    const [questions, classes, auditLogs] = await Promise.all([
      adminRepository.listUnroutedQuestions(),
      adminRepository.listClasses({ status: 'active' }),
      adminRepository.listAuditLogs(100),
    ])
    return { questions, classes, auditLogs }
  }, [])
  const { data, loading, error, reload } = useAsyncData(loader)
  const [selections, setSelections] = useState({})
  const [feedback, setFeedback] = useState('')
  async function route(question) {
    const classId = selections[question.id]
    if (!classId) {
      setFeedback('Hãy chọn lớp tín chỉ phù hợp.')
      return
    }
    try {
      await adminRepository.routeQuestion(question.id, classId)
      setFeedback('Đã điều phối câu hỏi.')
      reload()
    } catch (cause) {
      setFeedback(cause.message)
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
        <p className="admin-feedback" role="status">
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
                      onClick={() => route(question)}
                    >
                      Điều phối
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
