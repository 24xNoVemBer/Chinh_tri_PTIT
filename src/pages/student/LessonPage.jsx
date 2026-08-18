import { useCallback, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircleQuestion,
  Search,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ProgressBar from '../../components/common/ProgressBar'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository } from '../../services/appRepositories'

function getParagraphs(contentHtml) {
  return contentHtml
    .split(/<\/p>/i)
    .map((paragraph) => paragraph.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
}

export default function LessonPage() {
  const { user: currentStudent } = useAuth()
  const { lessonId } = useParams()
  const [updating, setUpdating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const loader = useCallback(
    () => learningRepository.getLessonForStudent(currentStudent.id, lessonId),
    [lessonId, currentStudent.id],
  )
  const { data: lesson, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải bài học…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!lesson) return <EmptyState title="Không tìm thấy bài học" />

  const handleComplete = async () => {
    setUpdating(true)
    setFeedback('')
    setFeedbackError(false)
    try {
      await learningRepository.updateProgress(currentStudent.id, lesson.id, 100)
      setFeedback('Đã đánh dấu hoàn thành bài học.')
      await reload()
    } catch (nextError) {
      setFeedback(nextError.message ?? 'Không thể cập nhật tiến độ bài học.')
      setFeedbackError(true)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <article className="page-stack reading-page">
      <Link className="text-link" to={`/student/subjects/${lesson.subject.id}`}>
        <ChevronLeft aria-hidden="true" size={16} />
        Quay lại {lesson.subject.name}
      </Link>

      <PageHeader
        eyebrow={lesson.chapter?.title ?? 'Bài học'}
        title={lesson.title}
        description={`Nội dung thuộc môn ${lesson.subject.name}. Bạn có thể tra cứu hoặc đặt câu hỏi trong đúng phạm vi bài này.`}
        actions={
          <div className="button-group">
            <Link
              className="button button--secondary"
              to={`/student/search?subject=${lesson.subject.id}&lesson=${lessonId}`}
            >
              <Search aria-hidden="true" size={18} />
              Tra cứu trong bài
            </Link>
            <Link
              className="button button--primary"
              to={`/student/subjects/${lesson.subject.id}/qna?lesson=${lessonId}`}
            >
              <MessageCircleQuestion aria-hidden="true" size={18} />
              Đặt câu hỏi
            </Link>
          </div>
        }
      />

      <section className="lesson-progress" aria-labelledby="lesson-progress-title">
        <div className="lesson-progress__copy">
          <div>
            <p className="section-heading__eyebrow">Tiến độ cá nhân</p>
            <h2 id="lesson-progress-title">
              {lesson.progress === 100 ? 'Đã hoàn thành' : `${lesson.progress}% đã đọc`}
            </h2>
          </div>
          <strong>{lesson.progress}%</strong>
        </div>
        <ProgressBar value={lesson.progress} label={`Tiến độ bài học ${lesson.progress}%`} />
        <button
          className="button button--secondary"
          type="button"
          disabled={updating || lesson.progress === 100}
          onClick={handleComplete}
        >
          <CheckCircle2 aria-hidden="true" size={18} />
          {lesson.progress === 100
            ? 'Đã hoàn thành'
            : updating
              ? 'Đang cập nhật…'
              : 'Đánh dấu hoàn thành'}
        </button>
      </section>

      {feedback && (
        <div
          className={`feedback-banner ${feedbackError ? 'feedback-banner--error' : ''}`}
          role={feedbackError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback}
        </div>
      )}

      <div className="reading-surface">
        {getParagraphs(lesson.contentHtml).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <nav className="lesson-pagination" aria-label="Điều hướng bài học">
        {lesson.previousLesson ? (
          <Link
            className="button button--secondary"
            to={`/student/lessons/${lesson.previousLesson.id}`}
          >
            <ChevronLeft aria-hidden="true" size={18} />
            <span>
              <small>Bài trước</small>
              {lesson.previousLesson.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {lesson.nextLesson && (
          <Link
            className="button button--secondary"
            to={`/student/lessons/${lesson.nextLesson.id}`}
          >
            <span>
              <small>Bài tiếp theo</small>
              {lesson.nextLesson.title}
            </span>
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        )}
      </nav>
    </article>
  )
}
