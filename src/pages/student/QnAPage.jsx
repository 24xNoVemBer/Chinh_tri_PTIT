import { useCallback, useState } from 'react'
import { Send } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository } from '../../services/appRepositories'
import { questionRepository } from '../../services/appRepositories'

const MIN_QUESTION_LENGTH = 10

export default function QnAPage() {
  const { user: currentStudent } = useAuth()
  const { subjectId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [lessonId, setLessonId] = useState(() => searchParams.get('lesson') ?? '')
  const [content, setContent] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loader = useCallback(
    () => learningRepository.getSubjectOverview(currentStudent.id, subjectId),
    [subjectId, currentStudent.id],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang chuẩn bị biểu mẫu hỏi đáp…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data) return <EmptyState title="Không tìm thấy môn học" />

  const trimmedContent = content.trim()
  const contentError =
    touched && trimmedContent.length < MIN_QUESTION_LENGTH
      ? `Câu hỏi cần có ít nhất ${MIN_QUESTION_LENGTH} ký tự.`
      : ''
  const lessons = data.chapters.flatMap((chapter) => chapter.lessons)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    setSubmitError('')
    if (trimmedContent.length < MIN_QUESTION_LENGTH) return

    setSubmitting(true)
    try {
      const question = await questionRepository.create({
        subjectId,
        lessonId: lessonId || undefined,
        studentId: currentStudent.id,
        content: trimmedContent,
      })
      navigate(`/student/questions/${question.id}`, { state: { created: true } })
    } catch (nextError) {
      setSubmitError(nextError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack page-stack--narrow">
      <PageHeader
        eyebrow={data.subject.name}
        title="Đặt câu hỏi mới"
        description="Bản demo gửi câu hỏi tới giảng viên. Các tình huống RAG mẫu có sẵn trong Lịch sử để review UI/UX."
      />
      <form className="form-surface question-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="question-lesson">Bài học liên quan</label>
          <select
            id="question-lesson"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
          >
            <option value="">Câu hỏi chung của môn</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
          <p className="field-hint">Chọn bài học giúp giảng viên hiểu đúng bối cảnh.</p>
        </div>

        <div className="field-group">
          <label htmlFor="question-content">Nội dung câu hỏi</label>
          <textarea
            id="question-content"
            rows="8"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-describedby="question-hint question-error"
            aria-invalid={Boolean(contentError)}
            placeholder="Mô tả điều bạn chưa rõ và bối cảnh của câu hỏi…"
          />
          <p id="question-hint" className="field-hint">
            Nêu rõ khái niệm, lập luận hoặc ví dụ bạn đang gặp khó khăn.
          </p>
          {contentError && (
            <p id="question-error" className="field-error" role="alert">
              {contentError}
            </p>
          )}
        </div>

        <div className="mock-disclosure">
          Bản demo không gọi model RAG. Khi tích hợp sau, câu trả lời sẽ luôn hiển thị nguồn học
          liệu và trạng thái kiểm duyệt trước khi được coi là nội dung đã xác nhận.
        </div>

        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}

        <div className="form-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => navigate(`/student/subjects/${subjectId}`)}
          >
            Hủy
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting || trimmedContent.length < MIN_QUESTION_LENGTH}
          >
            <Send aria-hidden="true" size={18} />
            {submitting ? 'Đang gửi…' : 'Gửi câu hỏi'}
          </button>
        </div>
      </form>
    </div>
  )
}
