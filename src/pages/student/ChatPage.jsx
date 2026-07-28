import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Clock3,
  FileText,
  History,
  MessageCircleQuestion,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { chatRepository, learningRepository } from '../../services/appRepositories'
import './ChatPage.css'

const SUGGESTIONS = [
  'Mối liên hệ phổ biến được hiểu như thế nào?',
  'Phân biệt vật chất và ý thức bằng một ví dụ.',
  'Tư tưởng Hồ Chí Minh về đại đoàn kết gồm những điểm nào?',
]

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Bạn có thể hỏi theo môn học hoặc khái niệm đang học. Mình sẽ trả lời bằng dữ liệu mô phỏng để bạn review trải nghiệm trước khi nối model.',
    citations: [],
  },
]

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const inputRef = useRef(null)
  const threadRef = useRef(null)
  const subjectLoader = useCallback(
    () => learningRepository.listSubjectProgress(user.id),
    [user.id],
  )
  const {
    data: subjects,
    loading: subjectsLoading,
    error: subjectsError,
  } = useAsyncData(subjectLoader)
  const effectiveSubjectId = selectedSubjectId || subjects?.[0]?.id || ''

  const latestCitations = useMemo(
    () => [...messages].reverse().find((message) => message.citations?.length)?.citations ?? [],
    [messages],
  )

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [messages, isReplying])

  const selectSuggestion = (suggestion) => {
    setQuestion(suggestion)
    setError('')
    inputRef.current?.focus()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      setError('Nhập câu hỏi trước khi gửi.')
      inputRef.current?.focus()
      return
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
      citations: [],
    }
    if (!effectiveSubjectId) {
      setError('Chọn học phần trước khi gửi.')
      return
    }

    setMessages((current) => [...current, userMessage])
    setQuestion('')
    setError('')
    setIsReplying(true)

    chatRepository
      .createMessage({ content: trimmedQuestion, subjectId: effectiveSubjectId })
      .then((reply) => {
        const selectedSubject = subjects?.find((subject) => subject.id === effectiveSubjectId)
        setMessages((current) => [
          ...current,
          {
            id: reply.responseId,
            role: 'assistant',
            content: reply.content,
            citations: reply.citations,
            reviewStatus: reply.reviewStatus,
            moderation: reply.moderation,
            subjectName: selectedSubject?.name,
          },
        ])
      })
      .catch((requestError) => {
        setError(requestError.message)
        setMessages((current) => current.filter((message) => message.id !== userMessage.id))
        setQuestion(trimmedQuestion)
      })
      .finally(() => {
        setIsReplying(false)
      })
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
          <p>Trợ giảng hội thoại</p>
          <h1>Chào {user?.name.split(' ').at(-1)}, bạn đang học phần nào?</h1>
        </div>
        <span className="chat-demo-badge">
          <Bot aria-hidden="true" size={16} />
          Demo UI, chưa nối model
        </span>
      </header>

      <div className="chat-layout">
        <aside className="chat-context" aria-labelledby="chat-context-title">
          <div>
            <MessageCircleQuestion aria-hidden="true" size={22} />
            <h2 id="chat-context-title">Hỏi có bối cảnh</h2>
            <p>Nêu tên môn, chương hoặc luận điểm để câu trả lời bám sát điều bạn đang học.</p>
          </div>

          <label className="chat-context__field">
            <span>Học phần đang hỏi</span>
            <select
              value={effectiveSubjectId}
              disabled={subjectsLoading || !subjects?.length}
              onChange={(event) => {
                setSelectedSubjectId(event.target.value)
                setError('')
              }}
            >
              {subjectsLoading && <option value="">Đang tải học phần…</option>}
              {!subjectsLoading && !subjects?.length && <option value="">Chưa có học phần</option>}
              {subjects?.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {subjectsError && <small>Không thể tải học phần. Hãy tải lại trang.</small>}
          </label>

          <nav aria-label="Công cụ học tập liên quan">
            <Link to="/student/search">
              <BookOpenCheck aria-hidden="true" size={17} />
              Tra cứu học liệu
            </Link>
            <Link to="/student/questions">
              <History aria-hidden="true" size={17} />
              Lịch sử câu hỏi
            </Link>
          </nav>
        </aside>

        <section className="chat-panel" aria-labelledby="chat-panel-title">
          <div className="chat-panel__top">
            <div>
              <h2 id="chat-panel-title">Cuộc trò chuyện mới</h2>
              <p>Nội dung bên dưới là dữ liệu mô phỏng.</p>
            </div>
            <Clock3 aria-hidden="true" size={20} />
          </div>

          <div
            className="chat-thread"
            ref={threadRef}
            role="log"
            aria-live="polite"
            aria-busy={isReplying}
          >
            {messages.map((message) => (
              <article
                className={`chat-message chat-message--${message.role}`}
                key={message.id}
                aria-label={message.role === 'assistant' ? 'Trợ giảng demo' : 'Bạn'}
              >
                <div className="chat-message__identity">
                  {message.role === 'assistant' ? (
                    <Bot aria-hidden="true" size={17} />
                  ) : (
                    <span aria-hidden="true">{user?.name.charAt(0)}</span>
                  )}
                  <strong>{message.role === 'assistant' ? 'Trợ giảng demo' : 'Bạn'}</strong>
                </div>
                <p>{message.content}</p>

                {message.reviewStatus === 'pending_review' && (
                  <span className="chat-message__review-status">
                    {message.moderation?.requiresReview
                      ? 'AI tạo · Đang chờ giảng viên xem xét'
                      : 'AI tạo · Có thể sử dụng ngay · Kiểm tra lấy mẫu'}
                  </span>
                )}

                {message.citations?.length > 0 && (
                  <>
                    <div className="chat-message__citation">
                      <FileText aria-hidden="true" size={16} />
                      <span>
                        {message.citations[0].title}, {message.citations[0].location}
                      </span>
                    </div>
                    <div className="chat-message__feedback" aria-label="Đánh giá câu trả lời">
                      <span>Câu trả lời này có hữu ích không?</span>
                      <button
                        type="button"
                        aria-label="Câu trả lời hữu ích"
                        aria-pressed={feedback[message.id] === 'helpful'}
                        onClick={() =>
                          setFeedback((current) => ({ ...current, [message.id]: 'helpful' }))
                        }
                      >
                        <ThumbsUp aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Câu trả lời chưa hữu ích"
                        aria-pressed={feedback[message.id] === 'unhelpful'}
                        onClick={() =>
                          setFeedback((current) => ({ ...current, [message.id]: 'unhelpful' }))
                        }
                      >
                        <ThumbsDown aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}

            {isReplying && (
              <div className="chat-typing" role="status">
                <Bot aria-hidden="true" size={17} />
                <span>Đang chuẩn bị câu trả lời mẫu</span>
                <span className="chat-typing__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          <div className="chat-suggestions" aria-label="Câu hỏi gợi ý">
            {SUGGESTIONS.map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => selectSuggestion(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>

          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-question">
              Câu hỏi cho trợ giảng
            </label>
            <textarea
              id="chat-question"
              ref={inputRef}
              rows="2"
              value={question}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'chat-question-error' : 'chat-question-hint'}
              placeholder="Hỏi về một khái niệm hoặc luận điểm…"
              onChange={(event) => {
                setQuestion(event.target.value)
                if (error) setError('')
              }}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              type="submit"
              aria-label="Gửi câu hỏi"
              title="Gửi câu hỏi"
              disabled={isReplying || subjectsLoading || !effectiveSubjectId || !question.trim()}
            >
              <Send aria-hidden="true" size={19} />
            </button>
            <p
              id={error ? 'chat-question-error' : 'chat-question-hint'}
              role={error ? 'alert' : undefined}
            >
              {error || 'Nhấn Enter để gửi, Shift + Enter để xuống dòng.'}
            </p>
          </form>
        </section>

        <aside className="chat-sources" aria-labelledby="chat-sources-title">
          <div className="chat-sources__heading">
            <FileText aria-hidden="true" size={20} />
            <h2 id="chat-sources-title">Nguồn đang dùng</h2>
          </div>

          {latestCitations.length ? (
            <ol>
              {latestCitations.map((citation) => (
                <li key={`${citation.title}-${citation.location}`}>
                  <strong>{citation.title}</strong>
                  <span>{citation.author}</span>
                  <small>{citation.location}</small>
                </li>
              ))}
            </ol>
          ) : (
            <div className="chat-sources__empty">
              <FileText aria-hidden="true" size={22} />
              <p>Nguồn mẫu sẽ xuất hiện sau câu trả lời đầu tiên.</p>
            </div>
          )}

          <Link to="/student/search">
            Mở trang tra cứu
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </aside>
      </div>
    </div>
  )
}
