import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminTermsPage() {
  const loader = useCallback(() => adminRepository.listTerms(), [])
  const { data: loadedTerms, loading, error, reload } = useAsyncData(loader)
  const data = loadedTerms ?? []
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [creating, setCreating] = useState(false)
  async function update(termId, status) {
    if (busyId || creating) return
    setBusyId(termId)
    setFeedback('')
    setFeedbackError(false)
    try {
      await adminRepository.updateTerm(termId, { status })
      setFeedback('Đã cập nhật học kỳ.')
      await reload()
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể cập nhật học kỳ.')
      setFeedbackError(true)
    } finally {
      setBusyId('')
    }
  }
  if (loading) return <LoadingState label="Đang tải học kỳ…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Niên khóa</p>
          <h1>Học kỳ</h1>
          <p>Chuẩn hóa mốc thời gian và vòng đời của các lớp tín chỉ.</p>
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
              <h2>Danh sách học kỳ</h2>
              <p>{data.length} mốc đã khai báo.</p>
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Học kỳ</th>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.map((term) => (
                  <tr key={term.id}>
                    <td>
                      <strong>{term.name}</strong>
                      <small>{term.code}</small>
                    </td>
                    <td>
                      {term.starts_at || '—'} → {term.ends_at || '—'}
                    </td>
                    <td>
                      <select
                        aria-label={`Trạng thái ${term.name}`}
                        value={term.status}
                        disabled={Boolean(busyId) || creating}
                        onChange={(event) => update(term.id, event.target.value)}
                      >
                        <option value="upcoming">Sắp tới</option>
                        <option value="active">Đang diễn ra</option>
                        <option value="completed">Đã kết thúc</option>
                        <option value="archived">Lưu trữ</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (creating || busyId) return
            const formElement = event.currentTarget
            const form = new FormData(formElement)
            setCreating(true)
            setFeedback('')
            setFeedbackError(false)
            try {
              await adminRepository.createTerm({
                code: form.get('code'),
                name: form.get('name'),
                startsAt: form.get('startsAt') || null,
                endsAt: form.get('endsAt') || null,
                status: 'upcoming',
              })
              setFeedback('Đã tạo học kỳ.')
              formElement.reset()
              await reload()
            } catch (cause) {
              setFeedback(cause.message ?? 'Không thể tạo học kỳ.')
              setFeedbackError(true)
            } finally {
              setCreating(false)
            }
          }}
        >
          <h2>Tạo học kỳ</h2>
          <div className="admin-field">
            <label htmlFor="term-code">Mã học kỳ</label>
            <input id="term-code" name="code" placeholder="HK1-2026-2027" required />
          </div>
          <div className="admin-field">
            <label htmlFor="term-name">Tên hiển thị</label>
            <input id="term-name" name="name" required />
          </div>
          <div className="admin-form__row">
            <div className="admin-field">
              <label htmlFor="term-start">Bắt đầu</label>
              <input id="term-start" name="startsAt" type="date" />
            </div>
            <div className="admin-field">
              <label htmlFor="term-end">Kết thúc</label>
              <input id="term-end" name="endsAt" type="date" />
            </div>
          </div>
          <div className="admin-actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={creating || Boolean(busyId)}
            >
              {creating ? 'Đang tạo…' : 'Tạo học kỳ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
