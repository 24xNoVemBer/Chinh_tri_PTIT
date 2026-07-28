import { useCallback, useState } from 'react'
import { ArrowRight, BookOpenText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import RagAnswerPanel from '../../components/common/RagAnswerPanel'
import StatusLabel from '../../components/common/StatusLabel'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { questionRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'

export default function ReviewQueuePage() {
  const { user: currentLecturer } = useAuth()
  const [priority, setPriority] = useState('attention')
  const loader = useCallback(
    () => questionRepository.listRagReviews(currentLecturer.id, 'pending_review', priority),
    [currentLecturer.id, priority],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải hàng đợi kiểm duyệt…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Kiểm duyệt RAG"
        title="Hàng đợi câu trả lời"
        description="Ưu tiên ngoại lệ và câu trả lời cần chuyên môn; các câu rủi ro thấp chỉ được kiểm tra lấy mẫu."
      />
      <div className="filter-toolbar">
        <div className="filter-field">
          <label htmlFor="review-priority">Mức ưu tiên</label>
          <select
            id="review-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="attention">Cần giảng viên xem</option>
            <option value="high">Ưu tiên cao</option>
            <option value="medium">Cần xem xét</option>
            <option value="sample">Kiểm tra lấy mẫu</option>
            <option value="all">Tất cả câu trả lời</option>
          </select>
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyState
          title="Không có câu trả lời trong nhóm này"
          description="Chọn mức ưu tiên khác để xem các câu trả lời đang chờ."
        />
      ) : (
        <div className="question-list">
          {data.map((question) => (
            <article className="question-card question-card--actionable" key={question.id}>
              <div className="question-card__header">
                <div className="status-cluster">
                  <StatusLabel type={question.ragResponse.reviewStatus} />
                  <StatusLabel type={`risk_${question.ragResponse.moderation.priority}`} />
                </div>
                <time dateTime={question.ragResponse.createdAt}>
                  {formatDateTime(question.ragResponse.createdAt)}
                </time>
              </div>
              <p className="question-card__author">
                {question.courseClass?.name ?? question.subject?.name} · {question.student?.name}
              </p>
              <h2>{question.content}</h2>
              <p className="question-card__author">{question.ragResponse.moderation.reason}</p>
              <RagAnswerPanel response={question.ragResponse} compact />
              <div className="review-queue__footer">
                <span>
                  <BookOpenText aria-hidden="true" size={16} />
                  {question.ragResponse.citations.length} nguồn cần đối chiếu
                </span>
                <Link className="text-link" to={`/lecturer/questions/${question.id}`}>
                  Mở kiểm duyệt <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
