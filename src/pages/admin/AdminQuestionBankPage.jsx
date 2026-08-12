import { useCallback, useState } from 'react'
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
  async function selectSubject(value) {
    setSubjectId(value)
    if (!value) {
      setChapters([])
      return
    }
    try {
      setChapters(await adminRepository.listChapters(value))
    } catch (cause) {
      setFeedback(cause.message)
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
                <span
                  className={`admin-status ${question.status !== 'published' ? 'admin-status--muted' : ''}`}
                >
                  {question.status === 'published' ? 'Đã xuất bản' : question.status}
                </span>
              </li>
            ))}
          </ul>
          {!data.questions.length && <p className="admin-empty">Chưa có câu hỏi dùng chung.</p>}
        </section>
        <form
          className="admin-panel admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const options = ['A', 'B', 'C', 'D'].map((key) => ({
              key,
              content: form.get(`option${key}`),
            }))
            try {
              await adminRepository.createSharedQuestion({
                subjectId: form.get('subjectId'),
                chapterId: form.get('chapterId'),
                content: form.get('content'),
                explanation: form.get('explanation'),
                correctOptionKey: form.get('correctOptionKey'),
                options,
              })
              setFeedback('Đã xuất bản câu hỏi dùng chung.')
              event.currentTarget.reset()
              setSubjectId('')
              reload()
            } catch (cause) {
              setFeedback(cause.message)
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
            <button className="button button--primary" type="submit">
              Lưu & xuất bản
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
