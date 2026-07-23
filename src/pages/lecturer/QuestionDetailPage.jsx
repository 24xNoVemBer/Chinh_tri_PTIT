import { useCallback, useState } from 'react'
import { ArrowLeft, Check, MessageCircleQuestion, RotateCcw, Send, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
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

const MIN_ANSWER_LENGTH = 20

function RagReviewForm({ lecturerId, question, onReload }) {
  const response = question.ragResponse
  const [content, setContent] = useState(() => response.content)
  const [note, setNote] = useState('')
  const [submittingAction, setSubmittingAction] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [feedback, setFeedback] = useState('')
  const isPending = response.reviewStatus === 'pending_review'

  const review = async (action) => {
    setSubmittingAction(action)
    setSubmitError('')
    setFeedback('')
    try {
      await questionRepository.reviewRagResponse(response.id, {
        action,
        content: content.trim(),
        note: note.trim(),
        lecturerId,
      })
      setFeedback(
        action === 'approve'
          ? 'Đã duyệt và công bố câu trả lời cho sinh viên.'
          : action === 'needs_revision'
            ? 'Đã đánh dấu bản tổng hợp cần chỉnh sửa.'
            : 'Đã loại bản tổng hợp khỏi câu trả lời cho sinh viên.',
      )
      await onReload()
    } catch (reviewError) {
      setSubmitError(reviewError.message)
    } finally {
      setSubmittingAction('')
    }
  }

  return (
    <section className="form-surface rag-review-form" aria-labelledby="rag-review-title">
      <div className="rag-review-form__heading">
        <div>
          <p className="section-heading__eyebrow">Thao tác của giảng viên</p>
          <h2 id="rag-review-title">Kiểm duyệt bản tổng hợp</h2>
        </div>
        <StatusLabel type={response.reviewStatus} />
      </div>

      {isPending ? (
        <>
          <div className="field-group">
            <label htmlFor="rag-reviewed-content">Nội dung sau kiểm duyệt</label>
            <textarea
              id="rag-reviewed-content"
              rows="9"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              aria-describedby="rag-reviewed-content-hint"
            />
            <p className="field-hint" id="rag-reviewed-content-hint">
              Có thể sửa trực tiếp nội dung trước khi duyệt. Nguồn trích dẫn vẫn được lưu riêng.
            </p>
          </div>
          <div className="field-group">
            <label htmlFor="rag-review-note">Ghi chú nội bộ</label>
            <textarea
              id="rag-review-note"
              rows="3"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: cần đối chiếu lại trang 120…"
            />
          </div>
          {submitError && (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          )}
          <div className="review-actions">
            <button
              className="button button--secondary"
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={() => review('reject')}
            >
              <X aria-hidden="true" size={18} />
              Không sử dụng
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={() => review('needs_revision')}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Cần chỉnh sửa
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={Boolean(submittingAction) || content.trim().length < MIN_ANSWER_LENGTH}
              onClick={() => review('approve')}
            >
              <Check aria-hidden="true" size={18} />
              {submittingAction === 'approve' ? 'Đang duyệt…' : 'Duyệt và công bố'}
            </button>
          </div>
        </>
      ) : (
        <p className="pending-note">
          Quyết định kiểm duyệt đã được lưu. Bản demo giữ lịch sử này để minh họa trạng thái sau xử
          lý.
        </p>
      )}

      {feedback && (
        <div className="feedback-banner" role="status" aria-live="polite">
          {feedback}
        </div>
      )}
    </section>
  )
}

function AnswerForm({ lecturerId, question, onReload }) {
  const [answer, setAnswer] = useState(() => question.lecturerAnswer?.content ?? '')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [feedback, setFeedback] = useState('')
  const trimmedAnswer = answer.trim()
  const answerError =
    touched && trimmedAnswer.length < MIN_ANSWER_LENGTH
      ? `Câu trả lời cần ít nhất ${MIN_ANSWER_LENGTH} ký tự.`
      : ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    setFeedback('')
    setSubmitError('')
    if (trimmedAnswer.length < MIN_ANSWER_LENGTH) return

    setSubmitting(true)
    try {
      await questionRepository.answer(question.id, {
        lecturerId,
        content: trimmedAnswer,
      })
      setFeedback(
        question.lecturerAnswer
          ? 'Đã cập nhật câu trả lời cho sinh viên.'
          : 'Đã gửi câu trả lời cho sinh viên.',
      )
      await onReload()
    } catch (answerSubmitError) {
      setSubmitError(answerSubmitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form-surface answer-form" onSubmit={handleSubmit}>
      <div>
        <p className="section-heading__eyebrow">
          {question.lecturerAnswer ? 'Cập nhật nội dung' : 'Phương án thay thế'}
        </p>
        <h2>{question.lecturerAnswer ? 'Câu trả lời hiện tại' : 'Trả lời trực tiếp'}</h2>
      </div>
      <div className="field-group">
        <label htmlFor="lecturer-answer">Nội dung trả lời</label>
        <textarea
          id="lecturer-answer"
          rows="8"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={Boolean(answerError)}
          aria-describedby="lecturer-answer-hint lecturer-answer-error"
          placeholder="Giải thích rõ khái niệm, ví dụ và hướng đọc thêm nếu cần…"
        />
        <p className="field-hint" id="lecturer-answer-hint">
          Dùng khi không duyệt bản RAG hoặc khi cần trả lời hoàn toàn bằng chuyên môn của giảng
          viên.
        </p>
        {answerError && (
          <p className="field-error" id="lecturer-answer-error" role="alert">
            {answerError}
          </p>
        )}
      </div>
      {submitError && (
        <p className="field-error" role="alert">
          {submitError}
        </p>
      )}
      {feedback && (
        <div className="feedback-banner" role="status" aria-live="polite">
          {feedback}
        </div>
      )}
      <div className="form-actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting || trimmedAnswer.length < MIN_ANSWER_LENGTH}
        >
          <Send aria-hidden="true" size={18} />
          {submitting
            ? 'Đang lưu…'
            : question.lecturerAnswer
              ? 'Cập nhật câu trả lời'
              : 'Gửi câu trả lời'}
        </button>
      </div>
    </form>
  )
}

export default function QuestionDetailPage() {
  const { user: currentLecturer } = useAuth()
  const { questionId } = useParams()
  const loader = useCallback(
    () => questionRepository.getForLecturer(questionId, currentLecturer.id),
    [questionId, currentLecturer.id],
  )
  const { data: question, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải câu hỏi…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!question) return <EmptyState title="Không tìm thấy câu hỏi" />

  const backPath = question.courseClass
    ? `/lecturer/classes/${question.courseClass.id}/questions`
    : '/lecturer/questions'

  return (
    <div className="page-stack page-stack--narrow">
      <Link className="text-link" to={backPath}>
        <ArrowLeft aria-hidden="true" size={16} />
        Quay lại danh sách câu hỏi
      </Link>
      <PageHeader
        eyebrow={question.courseClass?.name ?? 'Hộp câu hỏi'}
        title="Chi tiết câu hỏi"
        description="Đối chiếu bản tổng hợp RAG với nguồn hoặc trả lời trực tiếp cho sinh viên."
      />

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
            <dt>Sinh viên</dt>
            <dd>{question.student?.name ?? 'Chưa xác định'}</dd>
          </div>
          <div>
            <dt>Môn học</dt>
            <dd>{question.subject?.name ?? 'Chưa xác định'}</dd>
          </div>
          <div>
            <dt>Bài học</dt>
            <dd>{question.lesson?.title ?? 'Câu hỏi chung'}</dd>
          </div>
        </dl>
      </article>

      {question.ragResponse && <RagAnswerPanel response={question.ragResponse} />}
      {question.ragResponse && (
        <RagReviewForm
          key={`${question.ragResponse.id}-${question.ragResponse.reviewStatus}`}
          lecturerId={currentLecturer.id}
          question={question}
          onReload={reload}
        />
      )}

      <AnswerForm
        key={`${question.id}-${question.lecturerAnswer?.updatedAt ?? 'new'}`}
        lecturerId={currentLecturer.id}
        question={question}
        onReload={reload}
      />
    </div>
  )
}
