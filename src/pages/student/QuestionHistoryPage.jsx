import { useCallback } from 'react'
import { ArrowRight, Clock3, MessageCircleQuestion, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import RagAnswerPanel from '../../components/common/RagAnswerPanel'
import StatusLabel from '../../components/common/StatusLabel'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { questionRepository } from '../../services/appRepositories'
import { searchRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'

export default function QuestionHistoryPage() {
  const { user: currentStudent } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = searchParams.get('view') === 'searches' ? 'searches' : 'questions'
  const loader = useCallback(async () => {
    const [questions, searches] = await Promise.all([
      questionRepository.listForStudent(currentStudent.id),
      searchRepository.listHistory(currentStudent.id),
    ])
    return { questions, searches }
  }, [currentStudent.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải lịch sử học tập…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack question-history-page">
      <PageHeader
        eyebrow="Sinh viên"
        title="Lịch sử hỏi đáp và tra cứu"
        description="Xem lại câu hỏi, câu trả lời RAG có nguồn, trạng thái kiểm duyệt và các lần tra cứu gần đây."
        actions={
          <Link className="button button--primary" to="/student/subjects">
            <MessageCircleQuestion aria-hidden="true" size={18} />
            Đặt câu hỏi từ môn học
          </Link>
        }
      />

      <div className="history-tabs" role="tablist" aria-label="Loại lịch sử">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'questions'}
          className={activeView === 'questions' ? 'history-tabs__tab--active' : ''}
          onClick={() => setSearchParams({ view: 'questions' })}
        >
          <MessageCircleQuestion aria-hidden="true" size={18} />
          Câu hỏi
          <span>{data.questions.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'searches'}
          className={activeView === 'searches' ? 'history-tabs__tab--active' : ''}
          onClick={() => setSearchParams({ view: 'searches' })}
        >
          <Search aria-hidden="true" size={18} />
          Tra cứu
          <span>{data.searches.length}</span>
        </button>
      </div>

      {activeView === 'questions' && (
        <section className="section-stack" aria-labelledby="question-history-title">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Hỏi đáp của tôi</p>
              <h2 id="question-history-title">{data.questions.length} câu hỏi</h2>
            </div>
          </div>
          {data.questions.length === 0 ? (
            <EmptyState
              title="Bạn chưa đặt câu hỏi"
              description="Mở một môn học hoặc bài học để bắt đầu."
              action={
                <Link className="button button--primary" to="/student/subjects">
                  Chọn môn học
                </Link>
              }
            />
          ) : (
            <div className="question-list">
              {data.questions.map((question) => (
                <article className="question-card question-card--actionable" key={question.id}>
                  <div className="question-card__header">
                    <StatusLabel type={question.status} />
                    <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
                  </div>
                  <p className="question-card__author">
                    {question.subject?.name ?? 'Chưa xác định môn'}
                    {question.lesson ? ` · ${question.lesson.title}` : ''}
                  </p>
                  <h3>
                    <Link to={`/student/questions/${question.id}`}>{question.content}</Link>
                  </h3>
                  {question.lecturerAnswer && (
                    <div className="answer-panel">
                      <p className="answer-panel__label">Giảng viên trả lời</p>
                      <p>{question.lecturerAnswer.content}</p>
                    </div>
                  )}
                  {!question.lecturerAnswer && question.ragResponse && (
                    <RagAnswerPanel response={question.ragResponse} compact />
                  )}
                  {!question.lecturerAnswer && !question.ragResponse && question.ragRequest && (
                    <div className="answer-panel answer-panel--pending">
                      <StatusLabel type={question.ragRequest.status} />
                      <p>
                        {question.ragRequest.errorMessage ||
                          'Câu hỏi đang được chuyển tới giảng viên.'}
                      </p>
                    </div>
                  )}
                  <Link className="text-link" to={`/student/questions/${question.id}`}>
                    Xem chi tiết <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'searches' && (
        <section className="section-stack" aria-labelledby="search-history-title">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Lịch sử tra cứu</p>
              <h2 id="search-history-title">{data.searches.length} lần tra cứu</h2>
            </div>
            <Link className="text-link" to="/student/search">
              Tra cứu mới <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          {data.searches.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử tra cứu"
              description="Các từ khóa đã tìm sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="history-list">
              {data.searches.map((item) => {
                const params = new URLSearchParams({ q: item.query })
                if (item.subjectId) params.set('subject', item.subjectId)
                if (item.lessonId) params.set('lesson', item.lessonId)
                return (
                  <article className="history-item" key={item.id}>
                    <span className="history-item__icon">
                      <Clock3 aria-hidden="true" size={19} />
                    </span>
                    <div>
                      <p className="content-card__meta">
                        {item.subject?.name ?? 'Tất cả môn'}
                        {item.lesson ? ` · ${item.lesson.title}` : ''}
                      </p>
                      <h3>{item.query}</h3>
                      <p>
                        {item.resultCount} kết quả · {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <Link className="button button--secondary" to={`/student/search?${params}`}>
                      Mở tra cứu
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
