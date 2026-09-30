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
  'Theo giáo trình, vật chất được định nghĩa như thế nào?',
  'Tư tưởng Hồ Chí Minh về đại đoàn kết gồm những điểm nào?',
]

const MBA_SUGGESTIONS = {
  sub1: ['Trình bày định nghĩa vật chất của V.I. Lênin.'],
  sub2: ['Theo giáo trình, hàng hóa có những thuộc tính cơ bản nào?'],
  sub3: ['Theo giáo trình, sứ mệnh lịch sử của giai cấp công nhân là gì?'],
  sub5: ['Đại hội XIII xác định mục tiêu đến năm 2030 và tầm nhìn 2045 như thế nào?'],
}

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Bạn có thể hỏi theo môn học hoặc khái niệm đang học. Hãy kiểm tra chế độ kết nối và nguồn trích dẫn bên dưới; nội dung thử nghiệm không thay thế giáo trình.',
    citations: [],
  },
]

function renderAssistantText(content) {
  return String(content)
    .split(/(\*\*[^\n]+?\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    )
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const inputRef = useRef(null)
  const threadRef = useRef(null)
  const messageSequence = useRef(0)
  const statusLoader = useCallback(() => chatRepository.getStatus(), [])
  const { data: chatStatus, loading: statusLoading } = useAsyncData(statusLoader)
  const modeLabels = {
    extractive: 'Local · truy xuất, chưa dùng LLM',
    model: 'Đã cấu hình RAG · trả lời bằng model',
    mba: 'Đã kết nối MBA_API · nguồn chưa đối chiếu',
    demo: 'Demo UI · câu trả lời mô phỏng',
    unavailable: 'Chưa kết nối được dịch vụ RAG',
  }
  const statusLabel = statusLoading
    ? 'Đang kiểm tra kết nối…'
    : modeLabels[chatStatus?.mode || 'unavailable']
  const subjectLoader = useCallback(
    () => learningRepository.listSubjectProgress(user.id),
    [user.id],
  )
  const {
    data: subjects,
    loading: subjectsLoading,
    error: subjectsError,
  } = useAsyncData(subjectLoader)
  const selectableSubjects =
    chatStatus?.mode === 'mba'
      ? subjects?.filter((subject) => chatStatus.enabledSubjectIds?.includes(subject.id))
      : subjects
  const effectiveSubjectId = selectableSubjects?.some((subject) => subject.id === selectedSubjectId)
    ? selectedSubjectId
    : selectableSubjects?.[0]?.id || ''
  const selectedSubject = selectableSubjects?.find((subject) => subject.id === effectiveSubjectId)
  const availableClasses = selectedSubject?.classes ?? []
  const effectiveClassId = availableClasses.some(
    (courseClass) => courseClass.id === selectedClassId,
  )
    ? selectedClassId
    : availableClasses[0]?.id || ''
  const suggestions =
    chatStatus?.mode === 'mba' ? (MBA_SUGGESTIONS[effectiveSubjectId] ?? []) : SUGGESTIONS
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.id === 'welcome' || message.subjectId === effectiveSubjectId,
      ),
    [messages, effectiveSubjectId],
  )

  const latestSources = useMemo(() => {
    const latest = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'assistant' &&
          message.id !== 'welcome' &&
          message.subjectId === effectiveSubjectId,
      )
    return latest?.citations?.length ? latest.citations : (latest?.sources ?? [])
  }, [messages, effectiveSubjectId])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [visibleMessages, isReplying])

  const selectSuggestion = (suggestion) => {
    setQuestion(suggestion)
    setError('')
    inputRef.current?.focus()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isReplying) return
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      setError('Nhập câu hỏi trước khi gửi.')
      inputRef.current?.focus()
      return
    }

    messageSequence.current += 1
    const userMessage = {
      id: `user-${messageSequence.current}`,
      role: 'user',
      subjectId: effectiveSubjectId,
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
      .createMessage({
        content: trimmedQuestion,
        subjectId: effectiveSubjectId,
        classId: effectiveClassId,
      })
      .then((reply) => {
        setMessages((current) => [
          ...current,
          {
            id: reply.responseId,
            role: 'assistant',
            content: reply.content,
            citations: reply.citations,
            sources: reply.sources,
            reviewStatus: reply.reviewStatus,
            moderation: reply.moderation,
            answerMode: reply.answerMode,
            subjectId: effectiveSubjectId,
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
          {statusLabel}
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
              disabled={isReplying || subjectsLoading || !selectableSubjects?.length}
              onChange={(event) => {
                setSelectedSubjectId(event.target.value)
                setSelectedClassId('')
                setError('')
              }}
            >
              {subjectsLoading && <option value="">Đang tải học phần…</option>}
              {!subjectsLoading && !selectableSubjects?.length && (
                <option value="">Chưa có học phần được kết nối</option>
              )}
              {selectableSubjects?.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {subjectsError && <small>Không thể tải học phần. Hãy tải lại trang.</small>}
          </label>

          <label className="chat-context__field">
            <span>Lớp tín chỉ</span>
            <select
              value={effectiveClassId}
              disabled={isReplying || !availableClasses.length}
              onChange={(event) => {
                setSelectedClassId(event.target.value)
                setError('')
              }}
            >
              {!availableClasses.length && <option value="">Chưa có lớp đã ghi danh</option>}
              {availableClasses.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.classCode} · Tổ {courseClass.groupNumber}
                </option>
              ))}
            </select>
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
              <p>
                {chatStatus?.sampleData
                  ? 'DỮ LIỆU THỬ KỸ THUẬT · Chưa được thẩm định. Hãy hỏi từng câu đầy đủ.'
                  : chatStatus?.dataset === 'private'
                    ? 'GIÁO TRÌNH PILOT RIÊNG · Chưa được giảng viên thẩm định. Luôn kiểm tra trang trích dẫn.'
                    : chatStatus?.mode === 'mba'
                      ? 'MBA_API · Mỗi câu hỏi độc lập. Nguồn truy xuất chưa được đối chiếu với học liệu lớp.'
                      : 'Kiểm tra trích dẫn và trạng thái duyệt trước khi sử dụng câu trả lời.'}
              </p>
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
            {visibleMessages.map((message) => (
              <article
                className={`chat-message chat-message--${message.role}`}
                key={message.id}
                aria-label={message.role === 'assistant' ? 'Trợ giảng' : 'Bạn'}
              >
                <div className="chat-message__identity">
                  {message.role === 'assistant' ? (
                    <Bot aria-hidden="true" size={17} />
                  ) : (
                    <span aria-hidden="true">{user?.name.charAt(0)}</span>
                  )}
                  <strong>{message.role === 'assistant' ? 'Trợ giảng' : 'Bạn'}</strong>
                </div>
                <p>
                  {message.role === 'assistant'
                    ? renderAssistantText(message.content)
                    : message.content}
                </p>

                {message.reviewStatus === 'pending_review' && (
                  <span className="chat-message__review-status">
                    {message.answerMode === 'extractive'
                      ? 'Trích xuất tự động · Không phải câu trả lời do LLM tạo'
                      : message.moderation?.requiresReview
                        ? 'AI tạo · Đang chờ giảng viên xem xét'
                        : 'AI tạo · Có thể sử dụng ngay · Kiểm tra lấy mẫu'}
                  </span>
                )}

                {message.reviewStatus === 'unverified' && (
                  <span className="chat-message__review-status">
                    AI tạo · Nguồn MBA_API chưa được đối chiếu học liệu lớp
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
                {message.sources?.length > 0 && (
                  <div className="chat-message__citation">
                    <FileText aria-hidden="true" size={16} />
                    <span>Nguồn truy xuất MBA_API · chưa xác thực trích dẫn</span>
                  </div>
                )}
              </article>
            ))}

            {isReplying && (
              <div className="chat-typing" role="status">
                <Bot aria-hidden="true" size={17} />
                <span>Đang truy xuất nguồn và chuẩn bị câu trả lời…</span>
                <span className="chat-typing__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="chat-suggestions" aria-label="Câu hỏi gợi ý">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => selectSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

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
              disabled={
                isReplying ||
                subjectsLoading ||
                !effectiveSubjectId ||
                !effectiveClassId ||
                !question.trim()
              }
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

          {latestSources.length ? (
            <ol>
              {latestSources.map((citation) => (
                <li key={citation.id}>
                  <strong>{citation.title}</strong>
                  <span>{citation.author}</span>
                  <small>{citation.location}</small>
                  {citation.quote && (
                    <details>
                      <summary>Xem đoạn trích</summary>
                      <p>{citation.quote}</p>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="chat-sources__empty">
              <FileText aria-hidden="true" size={22} />
              <p>Nguồn sẽ xuất hiện khi tìm được đoạn tài liệu phù hợp.</p>
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
