import { Archive, FileUp, Send } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncState'
import useAsyncData from '../../hooks/useAsyncData'
import { adminRepository } from '../../services/appRepositories'
import './AdminPage.css'

export default function AdminQuestionBankPage() {
  const loader = useCallback(async () => {
    const [questions, subjects] = await Promise.all([
      adminRepository.listSharedQuestions(),
      adminRepository.listSubjects({ status: 'active' }),
    ])
    return { questions, subjects }
  }, [])
  const { data, loading, error, reload } = useAsyncData(loader)
  const [subjectId, setSubjectId] = useState('')
  const [chapters, setChapters] = useState([])
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [creating, setCreating] = useState(false)
  async function mutateQuestion(question, action) {
    if (busyId || creating) return
    setBusyId(question.id)
    setFeedback('')
    setFeedbackError(false)
    try {
      if (action === 'archive') {
        await adminRepository.archiveSharedQuestion(question.id)
        setFeedback('Đã lưu trữ câu hỏi.')
      } else {
        await adminRepository.updateSharedQuestion(question.id, {
          subjectId: question.subjectId,
          chapterId: question.chapterId,
          lessonId: question.lessonId,
          content: question.content,
          explanation: question.explanation,
          correctOptionKey: question.options.find((option) => option.isCorrect)?.key,
          options: question.options,
          status: 'published',
        })
        setFeedback('Đã xuất bản câu hỏi.')
      }
      await reload()
    } catch (cause) {
      setFeedback(cause.message ?? 'Không thể cập nhật câu hỏi.')
      setFeedbackError(true)
    } finally {
      setBusyId('')
    }
  }
  async function selectSubject(value) {
    setSubjectId(value)
    setFeedback('')
    setFeedbackError(false)
    if (!value) {
      setChapters([])
      return
    }
    try {
      setChapters(await adminRepository.listChapters(value))
    } catch (cause) {
      setChapters([])
      setFeedback(cause.message ?? 'Không thể tải danh sách chương.')
      setFeedbackError(true)
    }
  }
  if (loading) return <LoadingState label="Đang tải ngân hàng dùng chung…" />
  if (error) return <ErrorState onRetry={reload} />
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Phạm vi toàn môn</p>
          <h1>Câu hỏi trắc nghiệm dùng chung</h1>
          <p>Câu hỏi do admin phát hành sẽ sẵn sàng cho mọi lớp tín chỉ của môn.</p>
        </div>
        <Link className="button button--secondary" to="/admin/question-bank/import">
          <FileUp aria-hidden="true" size={18} /> Nhập từ CSV
        </Link>
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
              <h2>Ngân hàng hiện tại</h2>
              <p>{data.questions.length} câu hỏi dùng chung.</p>
            </div>
          </div>
          <ul className="admin-list">
            {data.questions.map((question) => (
              <li className="admin-list__item" key={question.id}>
                <div>
                  <strong>{question.content}</strong>
                  <small>
                    {question.subjectName} · {question.chapterTitle}
                  </small>
                </div>
                <div className="admin-inline-actions">
                  <span
                    className={`admin-status ${question.status !== 'published' ? 'admin-status--muted' : ''}`}
                  >
                    {question.status === 'published'
                      ? 'Đã xuất bản'
                      : question.status === 'draft'
                        ? 'Bản nháp'
                        : 'Lưu trữ'}
                  </span>
                  {question.status === 'draft' && (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={Boolean(busyId) || creating}
                      onClick={() => mutateQuestion(question, 'publish')}
                    >
                      <Send aria-hidden="true" size={15} /> Xuất bản
                    </button>
                  )}
                  {question.status !== 'archived' && (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={Boolean(busyId) || creating}
                      onClick={() => mutateQuestion(question, 'archive')}
                    >
                      <Archive aria-hidden="true" size={15} /> Lưu trữ
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!data.questions.length && <p className="admin-empty">Chưa có câu hỏi dùng chung.</p>}
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (creating || busyId) return
            const formElement = event.currentTarget
            const form = new FormData(formElement, event.nativeEvent.submitter)
            const requestedStatus = form.get('status')
            const options = ['A', 'B', 'C', 'D'].map((key) => ({
              key,
              content: form.get(`option${key}`),
            }))
            setCreating(true)
            setFeedback('')
            setFeedbackError(false)
            try {
              await adminRepository.createSharedQuestion({
                subjectId: form.get('subjectId'),
                chapterId: form.get('chapterId'),
                content: form.get('content'),
                explanation: form.get('explanation'),
                correctOptionKey: form.get('correctOptionKey'),
                status: requestedStatus,
                options,
              })
              setFeedback(
                requestedStatus === 'draft'
                  ? 'Đã lưu bản nháp.'
                  : 'Đã xuất bản câu hỏi dùng chung.',
              )
              formElement.reset()
              setSubjectId('')
              setChapters([])
              await reload()
            } catch (cause) {
              setFeedback(cause.message ?? 'Không thể tạo câu hỏi.')
              setFeedbackError(true)
            } finally {
              setCreating(false)
            }
          }}
        >
          <h2>Tạo câu hỏi</h2>
          <div className="admin-field">
            <label htmlFor="shared-subject">Môn học</label>
            <select
              id="shared-subject"
              name="subjectId"
              value={subjectId}
              onChange={(event) => selectSubject(event.target.value)}
              required
            >
              <option value="">Chọn môn</option>
              {data.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="shared-chapter">Chương</label>
            <select id="shared-chapter" name="chapterId" required disabled={!chapters.length}>
              <option value="">Chọn chương</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.chapter_order}. {chapter.title}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="shared-content">Nội dung câu hỏi</label>
            <textarea id="shared-content" name="content" required />
          </div>
          {['A', 'B', 'C', 'D'].map((key) => (
            <div className="admin-field" key={key}>
              <label htmlFor={`shared-option-${key}`}>Đáp án {key}</label>
              <input id={`shared-option-${key}`} name={`option${key}`} required />
            </div>
          ))}
          <div className="admin-field">
            <label htmlFor="shared-correct">Đáp án đúng</label>
            <select id="shared-correct" name="correctOptionKey">
              {['A', 'B', 'C', 'D'].map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="shared-explanation">Giải thích</label>
            <textarea id="shared-explanation" name="explanation" required />
          </div>
          <div className="admin-actions">
            <button
              className="button button--secondary"
              type="submit"
              name="status"
              value="draft"
              disabled={creating || Boolean(busyId)}
            >
              {creating ? 'Đang lưu…' : 'Lưu nháp'}
            </button>
            <button
              className="button button--primary"
              type="submit"
              name="status"
              value="published"
              disabled={creating || Boolean(busyId)}
            >
              {creating ? 'Đang lưu…' : 'Lưu & xuất bản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
