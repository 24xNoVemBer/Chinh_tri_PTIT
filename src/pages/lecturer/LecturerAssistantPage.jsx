import { Bot, Clock3, School, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'
import '../student/ChatPage.css'

const SUGGESTIONS = [
  'Gợi ý câu hỏi thảo luận về mối quan hệ giữa vật chất và ý thức.',
  'Hệ thống các ý chính cần nhấn mạnh trước buổi học.',
  'Gợi ý cách phản hồi một câu hỏi chưa rõ ý của sinh viên.',
]

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Thầy/cô có thể trao đổi về nội dung bài giảng, câu hỏi thảo luận, học liệu hoặc phản hồi cho sinh viên. Đây là giao diện demo và chưa kết nối mô hình AI.',
  },
]

function buildDemoReply() {
  return 'Ở bản demo dành cho giảng viên, Trợ giảng AI có thể hỗ trợ hệ thống nội dung trọng tâm, xây dựng câu hỏi thảo luận và gợi ý phản hồi theo ngữ cảnh lớp. Khi backend được kết nối, câu trả lời sẽ bám theo lớp và học liệu đã chọn.'
}

export default function LecturerAssistantPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const inputRef = useRef(null)
  const threadRef = useRef(null)
  const classLoader = useCallback(() => classRepository.listForLecturer(user.id), [user.id])
  const { data: classes, loading, error: classesError } = useAsyncData(classLoader)
  const effectiveClassId = selectedClassId || classes?.[0]?.id || ''

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (event) => {
    event.preventDefault()
    const content = question.trim()
    if (!content) {
      setError('Nhập nội dung cần trao đổi trước khi gửi.')
      inputRef.current?.focus()
      return
    }
    if (!effectiveClassId) {
      setError('Chọn lớp học trước khi gửi.')
      return
    }

    setMessages((current) => [
      ...current,
      { id: `lecturer-${Date.now()}`, role: 'user', content },
      { id: `assistant-${Date.now()}`, role: 'assistant', content: buildDemoReply(content) },
    ])
    setQuestion('')
    setError('')
  }

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div className="chat-page">
      <header className="chat-page__header">
        <div>
          <p>Trợ giảng dành cho giảng viên</p>
          <h1>Thầy/cô muốn chuẩn bị nội dung gì?</h1>
        </div>
        <span className="chat-demo-badge">
          <Bot aria-hidden="true" size={16} />
          Demo UI, chưa nối model
        </span>
      </header>

      <div className="chat-layout chat-layout--lecturer">
        <aside className="chat-context" aria-labelledby="lecturer-chat-context-title">
          <div>
            <School aria-hidden="true" size={22} />
            <h2 id="lecturer-chat-context-title">Trao đổi theo lớp</h2>
            <p>Chọn lớp để Trợ giảng AI hiểu đúng học phần, nội dung và nhóm sinh viên.</p>
          </div>
          <label className="chat-context__field">
            <span>Lớp học đang trao đổi</span>
            <select
              value={effectiveClassId}
              disabled={loading || !classes?.length}
              onChange={(event) => {
                setSelectedClassId(event.target.value)
                setError('')
              }}
            >
              {loading && <option value="">Đang tải lớp học…</option>}
              {!loading && !classes?.length && <option value="">Chưa có lớp học</option>}
              {classes?.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.name}
                </option>
              ))}
            </select>
            {classesError && <small>Không thể tải danh sách lớp. Hãy tải lại trang.</small>}
          </label>
        </aside>

        <section className="chat-panel" aria-labelledby="lecturer-chat-panel-title">
          <div className="chat-panel__top">
            <div>
              <h2 id="lecturer-chat-panel-title">Cuộc trò chuyện mới</h2>
              <p>Nội dung bên dưới là dữ liệu mô phỏng.</p>
            </div>
            <Clock3 aria-hidden="true" size={20} />
          </div>
          <div className="chat-thread" ref={threadRef} role="log" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`chat-message chat-message--${message.role}`}
                key={message.id}
                aria-label={message.role === 'assistant' ? 'Trợ giảng demo' : 'Giảng viên'}
              >
                <div className="chat-message__identity">
                  {message.role === 'assistant' ? (
                    <Bot aria-hidden="true" size={17} />
                  ) : (
                    <span aria-hidden="true">{user?.name.charAt(0)}</span>
                  )}
                  <strong>{message.role === 'assistant' ? 'Trợ giảng demo' : 'Thầy/cô'}</strong>
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <div className="chat-suggestions" aria-label="Gợi ý trao đổi cho giảng viên">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuestion(suggestion)
                  setError('')
                  inputRef.current?.focus()
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="lecturer-chat-question">
              Nội dung trao đổi với Trợ giảng AI
            </label>
            <textarea
              id="lecturer-chat-question"
              ref={inputRef}
              value={question}
              rows="2"
              aria-invalid={Boolean(error)}
              aria-describedby="lecturer-chat-hint"
              placeholder="Ví dụ: Gợi ý ba câu hỏi thảo luận cho bài học này…"
              onChange={(event) => {
                setQuestion(event.target.value)
                setError('')
              }}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              type="submit"
              aria-label="Gửi nội dung trao đổi"
              title="Gửi"
              disabled={loading || !effectiveClassId || !question.trim()}
            >
              <Send aria-hidden="true" size={19} />
            </button>
            <p id="lecturer-chat-hint" role={error ? 'alert' : undefined}>
              {error || 'Nhấn Enter để gửi, Shift + Enter để xuống dòng.'}
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
