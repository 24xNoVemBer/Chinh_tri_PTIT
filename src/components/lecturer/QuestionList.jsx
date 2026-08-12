import { ArrowRight, Hand, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../common/AsyncState'
import StatusLabel from '../common/StatusLabel'
import { formatDateTime } from '../../utils/format'

export default function QuestionList({
  questions,
  emptyTitle = 'Không có câu hỏi phù hợp',
  emptyDescription = 'Hãy thay đổi bộ lọc hoặc quay lại sau.',
  currentUserId,
  busyId,
  onClaim,
  onRelease,
}) {
  if (!questions.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="question-list">
      {questions.map((question) => (
        <article className="question-card question-card--actionable" key={question.id}>
          <div className="question-card__header">
            <div className="question-card__badges">
              <StatusLabel type={question.status} />
              {question.status === 'unanswered' && question.routingStatus && (
                <span className={`queue-label queue-label--${question.routingStatus}`}>
                  {question.routingStatus === 'queued'
                    ? 'Chưa có người nhận'
                    : question.claimedBy?.id === currentUserId
                      ? 'Bạn đang xử lý'
                      : `${question.claimedBy?.name ?? 'Giảng viên khác'} đang xử lý`}
                </span>
              )}
              {question.status === 'unanswered' &&
                question.sla &&
                question.sla.status !== 'on_track' && (
                  <span className={`sla-label sla-label--${question.sla.status}`}>
                    {question.sla.status === 'overdue' ? 'Quá hạn SLA' : 'Sắp đến hạn'}
                  </span>
                )}
            </div>
            <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
          </div>
          <h3>
            <Link to={`/lecturer/questions/${question.id}`}>{question.content}</Link>
          </h3>
          <p className="question-card__author">
            {question.student?.name ?? 'Sinh viên'}
            {question.courseClass ? ` · ${question.courseClass.name}` : ''}
            {question.lesson ? ` · ${question.lesson.title}` : ''}
          </p>
          {question.lecturerAnswer && (
            <div className="answer-panel">
              <p className="answer-panel__label">Câu trả lời hiện tại</p>
              <p>{question.lecturerAnswer.content}</p>
            </div>
          )}
          <div className="question-card__footer-actions">
            <Link className="text-link" to={`/lecturer/questions/${question.id}`}>
              {question.lecturerAnswer ? 'Xem chi tiết' : 'Mở câu hỏi'}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            {onClaim && question.status === 'unanswered' && question.routingStatus === 'queued' && (
              <button
                className="button button--primary"
                type="button"
                disabled={busyId === question.id}
                onClick={() => onClaim(question)}
              >
                <Hand aria-hidden="true" size={16} />
                Nhận xử lý
              </button>
            )}
            {onRelease &&
              question.status === 'unanswered' &&
              question.claimedBy?.id === currentUserId && (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={busyId === question.id}
                  onClick={() => onRelease(question)}
                >
                  <RotateCcw aria-hidden="true" size={16} />
                  Trả lại hàng đợi
                </button>
              )}
          </div>
        </article>
      ))}
    </div>
  )
}
