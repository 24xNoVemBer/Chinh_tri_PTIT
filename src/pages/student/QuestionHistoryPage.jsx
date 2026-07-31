import { useCallback, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  MessageCircleQuestion,
  MessageSquareReply,
  Search,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import StatusLabel from '../../components/common/StatusLabel'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { questionRepository, searchRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import './QuestionHistoryPage.css'

const EMPTY_ITEMS = []

const QUESTION_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'waiting', label: 'Chờ phản hồi' },
  { id: 'answered', label: 'Đã phản hồi' },
]

function getQuestionResponse(question) {
  if (question.lecturerAnswer) {
    return {
      content: question.lecturerAnswer.content,
      source: 'Giảng viên trả lời',
    }
  }

  if (question.ragResponse?.reviewStatus === 'approved') {
    return {
      content: question.ragResponse.content,
      source: 'Nội dung đã được duyệt',
    }
  }

  return null
}

function getPreviewText(value, maxLength = 240) {
  const source = String(value ?? '')
  const sample = source.slice(0, maxLength * 4)
  const normalized = sample.replace(/\s+/g, ' ').trim()
  const truncated = source.length > sample.length || normalized.length > maxLength
  if (!normalized) return 'Nội dung chưa được cập nhật.'
  return truncated ? `${normalized.slice(0, maxLength).trim()}…` : normalized
}

function isQuestionAnswered(question) {
  return Boolean(getQuestionResponse(question))
}

export default function QuestionHistoryPage() {
  const { user: currentStudent } = useAuth()
  const [searchParams] = useSearchParams()
  const [questionFilter, setQuestionFilter] = useState('all')
  const activeView = searchParams.get('view') === 'searches' ? 'searches' : 'questions'
  const loader = useCallback(async () => {
    const [questions, searches] = await Promise.all([
      questionRepository.listForStudent(currentStudent.id),
      searchRepository.listHistory(currentStudent.id),
    ])
    return { questions, searches }
  }, [currentStudent.id])
  const { data, loading, error, reload } = useAsyncData(loader)
  const questions = data?.questions ?? EMPTY_ITEMS
  const searches = data?.searches ?? EMPTY_ITEMS
  const answeredCount = questions.filter(isQuestionAnswered).length
  const waitingCount = questions.length - answeredCount
  const visibleQuestions = useMemo(
    () =>
      questions.filter((question) => {
        if (questionFilter === 'answered') return isQuestionAnswered(question)
        if (questionFilter === 'waiting') return !isQuestionAnswered(question)
        return true
      }),
    [questionFilter, questions],
  )

  if (loading) return <LoadingState label="Đang tải không gian hỏi đáp…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const filterCounts = {
    all: questions.length,
    answered: answeredCount,
    waiting: waitingCount,
  }

  return (
    <div className="page-stack question-history-page">
      <section className="question-history-overview" aria-labelledby="question-history-title">
        <div className="question-history-overview__topline">
          <div className="question-history-overview__copy">
            <p className="question-history-overview__eyebrow">Không gian hỏi đáp</p>
            <h1 id="question-history-title">Hỏi đáp của tôi</h1>
            <p>Theo dõi câu hỏi theo từng học phần và xem các phản hồi đã được xác nhận.</p>
          </div>
          <Link className="button button--primary" to="/student/subjects">
            <MessageCircleQuestion aria-hidden="true" size={18} />
            Chọn học phần để hỏi
          </Link>
        </div>

        <dl className="question-history-summary" aria-label="Tóm tắt hoạt động hỏi đáp">
          <div>
            <dt>Tổng câu hỏi</dt>
            <dd>{questions.length}</dd>
          </div>
          <div>
            <dt>Đã phản hồi</dt>
            <dd>{answeredCount}</dd>
          </div>
          <div>
            <dt>Chờ phản hồi</dt>
            <dd>{waitingCount}</dd>
          </div>
          <div>
            <dt>Lần tra cứu</dt>
            <dd>{searches.length}</dd>
          </div>
        </dl>
      </section>

      <nav className="question-history-views" aria-label="Nội dung hỏi đáp">
        <Link
          to="/student/questions"
          aria-current={activeView === 'questions' ? 'page' : undefined}
        >
          <MessageCircleQuestion aria-hidden="true" size={18} />
          Câu hỏi
          <span>{questions.length}</span>
        </Link>
        <Link
          to="/student/questions?view=searches"
          aria-current={activeView === 'searches' ? 'page' : undefined}
        >
          <Search aria-hidden="true" size={18} />
          Lịch sử tra cứu
          <span>{searches.length}</span>
        </Link>
      </nav>

      {activeView === 'questions' ? (
        <section className="question-history-panel" aria-labelledby="question-list-title">
          <header className="question-history-panel__header">
            <div>
              <h2 id="question-list-title">Câu hỏi theo học phần</h2>
              <p>Ưu tiên các câu hỏi đang chờ và mở trang chi tiết khi cần xem toàn bộ nội dung.</p>
            </div>
            <div className="question-history-filters" role="group" aria-label="Lọc câu hỏi">
              {QUESTION_FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  aria-pressed={questionFilter === filter.id}
                  onClick={() => setQuestionFilter(filter.id)}
                >
                  {filter.label}
                  <span>{filterCounts[filter.id]}</span>
                </button>
              ))}
            </div>
          </header>

          {questions.length === 0 ? (
            <EmptyState
              title="Bạn chưa đặt câu hỏi"
              description="Chọn một học phần để đặt câu hỏi theo đúng ngữ cảnh môn học."
              action={
                <Link className="button button--primary" to="/student/subjects">
                  Xem học phần
                </Link>
              }
            />
          ) : visibleQuestions.length === 0 ? (
            <div className="question-history-filter-empty">
              <CheckCircle2 aria-hidden="true" size={24} />
              <div>
                <h3>Không có câu hỏi ở trạng thái này</h3>
                <p>Chọn bộ lọc khác để xem toàn bộ lịch sử hỏi đáp.</p>
              </div>
              <button type="button" onClick={() => setQuestionFilter('all')}>
                Xem tất cả
              </button>
            </div>
          ) : (
            <div className="question-history-list" role="list">
              {visibleQuestions.map((question) => {
                const response = getQuestionResponse(question)
                const isAnswered = Boolean(response)
                return (
                  <article className="question-history-item" key={question.id} role="listitem">
                    <header className="question-history-item__header">
                      <div className="question-history-item__labels">
                        <StatusLabel type={isAnswered ? 'answered' : 'unanswered'} />
                        <span>{question.subject?.name ?? 'Chưa xác định học phần'}</span>
                      </div>
                      <time dateTime={question.createdAt}>
                        {formatDateTime(question.createdAt)}
                      </time>
                    </header>

                    <h3>
                      <Link to={`/student/questions/${question.id}`}>
                        {getPreviewText(question.content)}
                      </Link>
                    </h3>

                    {question.lesson && (
                      <p className="question-history-item__context">
                        <BookOpenCheck aria-hidden="true" size={16} />
                        <span>{getPreviewText(question.lesson.title, 120)}</span>
                      </p>
                    )}

                    {response ? (
                      <div className="question-history-item__response">
                        <MessageSquareReply aria-hidden="true" size={18} />
                        <div>
                          <small>{response.source}</small>
                          <p>{getPreviewText(response.content, 200)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="question-history-item__waiting">
                        <Clock3 aria-hidden="true" size={17} />
                        <span>
                          {question.ragResponse || question.ragRequest
                            ? 'Nội dung tổng hợp đang chờ giảng viên xem xét.'
                            : 'Câu hỏi đang chờ giảng viên phản hồi.'}
                        </span>
                      </div>
                    )}

                    <footer className="question-history-item__footer">
                      <span>{isAnswered ? 'Có phản hồi để xem' : 'Đã lưu trong lịch sử'}</span>
                      <Link to={`/student/questions/${question.id}`}>
                        Xem chi tiết
                        <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="question-history-panel" aria-labelledby="search-history-title">
          <header className="question-history-panel__header">
            <div>
              <h2 id="search-history-title">Lịch sử tra cứu</h2>
              <p>Mở lại từ khóa và phạm vi học phần đã sử dụng trước đó.</p>
            </div>
            <Link className="button button--secondary" to="/student/search">
              <Search aria-hidden="true" size={18} />
              Tra cứu mới
            </Link>
          </header>

          {searches.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử tra cứu"
              description="Các từ khóa đã tìm sẽ xuất hiện tại đây."
              action={
                <Link className="button button--primary" to="/student/search">
                  Bắt đầu tra cứu
                </Link>
              }
            />
          ) : (
            <div className="question-search-history" role="list">
              {searches.map((item) => {
                const params = new URLSearchParams({ q: item.query })
                if (item.subjectId) params.set('subject', item.subjectId)
                if (item.lessonId) params.set('lesson', item.lessonId)
                return (
                  <article className="question-search-item" key={item.id} role="listitem">
                    <span className="question-search-item__icon">
                      <Search aria-hidden="true" size={19} />
                    </span>
                    <div className="question-search-item__copy">
                      <p className="question-search-item__context">
                        {item.subject?.name ?? 'Tất cả học phần'}
                        {item.lesson ? <span>{getPreviewText(item.lesson.title, 100)}</span> : null}
                      </p>
                      <h3>{getPreviewText(item.query, 180)}</h3>
                      <p className="question-search-item__meta">
                        <span>{item.resultCount} kết quả</span>
                        <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                      </p>
                    </div>
                    <Link
                      className="button button--secondary"
                      to={`/student/search?${params}`}
                      aria-label={`Mở lại tra cứu ${getPreviewText(item.query, 60)}`}
                    >
                      Mở lại
                      <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
