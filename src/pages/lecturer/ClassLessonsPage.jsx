import { useCallback, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import StatusLabel from '../../components/common/StatusLabel'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classContentRepository } from '../../services/appRepositories'
import { classRepository } from '../../services/appRepositories'
import { formatDate } from '../../utils/format'

export default function ClassLessonsPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const [lessonId, setLessonId] = useState('')
  const [date, setDate] = useState('2023-10-03')
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')

  const loader = useCallback(async () => {
    const courseClass = await classRepository.getById(classId, {
      lecturerId: currentLecturer.id,
    })
    const [lessons, availableLessons] = await Promise.all([
      classContentRepository.listLessons(classId),
      classContentRepository.listAvailableLessons(classId),
    ])
    return { courseClass, lessons, availableLessons }
  }, [classId, currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải kế hoạch bài học…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!lessonId || !date) {
      setFormError('Hãy chọn bài học và ngày dự kiến.')
      return
    }

    setSubmitting(true)
    setFormError('')
    setFeedback('')
    try {
      await classContentRepository.scheduleLesson(classId, { lessonId, date })
      setLessonId('')
      setFeedback('Đã thêm bài học vào lớp ở trạng thái bản nháp.')
      await reload()
    } catch (submitError) {
      setFormError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (scheduledLesson, nextStatus) => {
    setUpdatingId(scheduledLesson.id)
    setFeedback('')
    try {
      await classContentRepository.updateLessonStatus(classId, scheduledLesson.id, nextStatus)
      setFeedback(
        nextStatus === 'published'
          ? 'Đã xuất bản bài học cho sinh viên.'
          : 'Đã chuyển bài học về bản nháp.',
      )
      await reload()
    } catch (updateError) {
      setFeedback(updateError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Bài học của lớp"
        description="Lên lịch nội dung từ chương trình môn học và kiểm soát trạng thái xuất bản."
      />
      <ClassSubnav classId={classId} />

      <section className="management-grid">
        <form className="form-surface management-form" onSubmit={handleSubmit}>
          <div>
            <p className="section-heading__eyebrow">Thêm nội dung</p>
            <h2>Lên lịch bài học</h2>
          </div>
          <div className="field-group">
            <label htmlFor="lesson-option">Bài học</label>
            <select
              id="lesson-option"
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
              aria-describedby="lesson-option-hint"
            >
              <option value="">Chọn bài học chưa được lên lịch</option>
              {data.availableLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.chapter?.title} · {lesson.title}
                </option>
              ))}
            </select>
            <p className="field-hint" id="lesson-option-hint">
              Bài học mới sẽ được tạo ở trạng thái bản nháp.
            </p>
          </div>
          <div className="field-group">
            <label htmlFor="lesson-date">Ngày dự kiến</label>
            <input
              id="lesson-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting || data.availableLessons.length === 0}
          >
            <Plus aria-hidden="true" size={18} />
            {submitting ? 'Đang thêm…' : 'Thêm bài học'}
          </button>
        </form>

        <section className="section-stack" aria-labelledby="scheduled-lessons-title">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Kế hoạch lớp</p>
              <h2 id="scheduled-lessons-title">{data.lessons.length} bài học</h2>
            </div>
          </div>
          {feedback && (
            <div className="feedback-banner" role="status" aria-live="polite">
              {feedback}
            </div>
          )}
          {data.lessons.length === 0 ? (
            <EmptyState title="Chưa có bài học" description="Hãy thêm bài học đầu tiên cho lớp." />
          ) : (
            <div className="management-list">
              {data.lessons.map((scheduledLesson) => (
                <article className="management-item" key={scheduledLesson.id}>
                  <div className="management-item__body">
                    <div className="management-item__meta">
                      <StatusLabel type={scheduledLesson.status} />
                      <span>
                        <CalendarDays aria-hidden="true" size={15} />
                        {formatDate(scheduledLesson.date)}
                      </span>
                    </div>
                    <h3>{scheduledLesson.lesson?.title}</h3>
                    <p>{scheduledLesson.chapter?.title}</p>
                  </div>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={updatingId === scheduledLesson.id}
                    onClick={() =>
                      handleStatusChange(
                        scheduledLesson,
                        scheduledLesson.status === 'published' ? 'draft' : 'published',
                      )
                    }
                  >
                    {scheduledLesson.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
