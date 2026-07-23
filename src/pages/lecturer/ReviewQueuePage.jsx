import { useCallback } from 'react'
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
  const loader = useCallback(
    () => questionRepository.listRagReviews(currentLecturer.id, 'pending_review'),
    [currentLecturer.id],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải hàng đợi kiểm duyệt…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Kiểm duyệt RAG"
        title="Hàng đợi câu trả lời"
        description="Đối chiếu nội dung với nguồn trích dẫn trước khi phê duyệt cho sinh viên."
      />
      {data.length === 0 ? (
        <EmptyState
          title="Không có câu trả lời chờ duyệt"
          description="Các bản tổng hợp mới có đủ nguồn sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="question-list">
          {data.map((question) => (
            <article className="question-card question-card--actionable" key={question.id}>
              <div className="question-card__header">
                <StatusLabel type={question.ragResponse.reviewStatus} />
                <time dateTime={question.ragResponse.createdAt}>
                  {formatDateTime(question.ragResponse.createdAt)}
                </time>
              </div>
              <p className="question-card__author">
                {question.courseClass?.name ?? question.subject?.name} · {question.student?.name}
              </p>
              <h2>{question.content}</h2>
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
