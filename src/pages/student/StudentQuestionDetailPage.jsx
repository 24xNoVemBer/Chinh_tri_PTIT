import { useCallback } from 'react'
import { ArrowLeft, MessageCircleQuestion } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import RagAnswerPanel from '../../components/common/RagAnswerPanel'
import StatusLabel from '../../components/common/StatusLabel'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { questionRepository } from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'

export default function StudentQuestionDetailPage() {
  const { user: currentStudent } = useAuth()
  const { questionId } = useParams()
  const location = useLocation()
  const loader = useCallback(
    () => questionRepository.getForStudent(questionId, currentStudent.id),
    [questionId, currentStudent.id],
  )
  const { data: question, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải câu hỏi…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!question) return <EmptyState title="Không tìm thấy câu hỏi" />

  const ragResponseVisible =
    question.ragResponse &&
    !['rejected', 'needs_revision'].includes(question.ragResponse.reviewStatus)
  const ragFailed = ['failed', 'cancelled'].includes(question.ragRequest?.status)
  const hasFinalAnswer =
    question.lecturerAnswer || question.ragResponse?.reviewStatus === 'approved'

  return (
    <div className="page-stack page-stack--narrow">
      <Link className="text-link" to="/student/questions">
        <ArrowLeft aria-hidden="true" size={16} />
        Quay lại lịch sử
      </Link>

      <PageHeader
        eyebrow={question.subject?.name ?? 'Hỏi đáp'}
        title="Chi tiết câu hỏi"
        description="Theo dõi câu trả lời RAG, nguồn học liệu và trạng thái kiểm duyệt của giảng viên."
      />

      {location.state?.created && (
        <div className="feedback-banner" role="status">
          {question.ragResponse
            ? 'Câu hỏi đã được gửi và có bản tổng hợp RAG để bạn tham khảo.'
            : 'Câu hỏi đã được gửi tới giảng viên.'}
        </div>
      )}

      <article className="question-detail">
        <div className="question-card__header">
          <StatusLabel type={question.status} />
          <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
        </div>
        <div className="question-detail__icon">
          <MessageCircleQuestion aria-hidden="true" size={22} />
        </div>
        <h2>{question.content}</h2>
        <dl className="metadata-list">
          <div>
            <dt>Môn học</dt>
            <dd>{question.subject?.name ?? 'Chưa xác định'}</dd>
          </div>
          <div>
            <dt>Chương</dt>
            <dd>{question.chapter?.title ?? 'Câu hỏi chung'}</dd>
          </div>
          <div>
            <dt>Bài học</dt>
            <dd>{question.lesson?.title ?? 'Không gắn bài học'}</dd>
          </div>
        </dl>
      </article>

      {ragResponseVisible && <RagAnswerPanel response={question.ragResponse} />}

      {ragFailed && (
        <div className="pending-note pending-note--warning" role="status">
          <StatusLabel type="failed" />
          <span>
            {question.ragRequest.errorMessage ||
              'Hệ thống chưa tạo được câu trả lời có đủ nguồn. Câu hỏi đã được chuyển tới giảng viên.'}
          </span>
        </div>
      )}

      {question.ragResponse && !ragResponseVisible && (
        <div className="pending-note pending-note--warning" role="status">
          <StatusLabel type={question.ragResponse.reviewStatus} />
          <span>
            Bản tổng hợp RAG chưa đạt yêu cầu. Giảng viên sẽ chỉnh sửa hoặc trả lời trực tiếp.
          </span>
        </div>
      )}

      {question.lecturerAnswer && (
        <section className="answer-panel" aria-labelledby="lecturer-answer-title">
          <p className="answer-panel__label">Câu trả lời chính thức</p>
          <h2 id="lecturer-answer-title">Giảng viên trả lời</h2>
          <p>{question.lecturerAnswer.content}</p>
        </section>
      )}

      {!hasFinalAnswer && !ragFailed && (
        <div className="pending-note">
          Câu hỏi vẫn nằm trong hàng xử lý của giảng viên. Nội dung RAG đang hiển thị chỉ là bản
          tham khảo cho tới khi được kiểm duyệt.
        </div>
      )}
    </div>
  )
}
