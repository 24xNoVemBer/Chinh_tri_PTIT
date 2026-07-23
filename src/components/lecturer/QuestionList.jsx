import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../common/AsyncState'
import StatusLabel from '../common/StatusLabel'
import { formatDateTime } from '../../utils/format'

export default function QuestionList({
  questions,
  emptyTitle = 'Không có câu hỏi phù hợp',
  emptyDescription = 'Hãy thay đổi bộ lọc hoặc quay lại sau.',
}) {
  if (!questions.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="question-list">
      {questions.map((question) => (
        <article className="question-card question-card--actionable" key={question.id}>
          <div className="question-card__header">
            <StatusLabel type={question.status} />
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
          <Link className="text-link" to={`/lecturer/questions/${question.id}`}>
            {question.lecturerAnswer ? 'Xem và chỉnh sửa' : 'Mở để trả lời'}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </article>
      ))}
    </div>
  )
}
