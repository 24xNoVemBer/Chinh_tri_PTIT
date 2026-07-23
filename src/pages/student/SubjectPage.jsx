import { useCallback } from 'react'
import { ArrowRight, CheckCircle2, MessageCircleQuestion, Search } from 'lucide-react'
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

export default function SubjectPage() {
  const { user: currentStudent } = useAuth()
  const { subjectId } = useParams()
  const loader = useCallback(
    () => learningRepository.getSubjectOverview(currentStudent.id, subjectId),
    [subjectId, currentStudent.id],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải môn học…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data) return <EmptyState title="Không tìm thấy môn học" />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${data.subject.credits} tín chỉ`}
        title={data.subject.name}
        description="Xem nội dung theo chương, theo dõi tiến độ hoặc tra cứu trong phạm vi môn học."
        actions={
          <div className="button-group">
            <Link className="button button--secondary" to={`/student/search?subject=${subjectId}`}>
              <Search aria-hidden="true" size={18} />
              Tra cứu
            </Link>
            <Link className="button button--primary" to={`/student/subjects/${subjectId}/qna`}>
              <MessageCircleQuestion aria-hidden="true" size={18} />
              Đặt câu hỏi
            </Link>
          </div>
        }
      />

      <section className="subject-progress-summary" aria-labelledby="subject-progress-title">
        <div>
          <p className="section-heading__eyebrow">Tiến độ môn học</p>
          <h2 id="subject-progress-title">{data.progress}% hoàn thành</h2>
          <p>
            {data.completedLessons}/{data.lessonCount} bài học đã hoàn thành
          </p>
        </div>
        <div className="subject-progress-summary__bar">
          <ProgressBar value={data.progress} label={`Tiến độ môn học ${data.progress}%`} />
        </div>
      </section>

      <div className="chapter-list">
        {data.chapters.map((chapter) => (
          <section className="chapter-card" key={chapter.id}>
            <div className="chapter-card__heading">
              <span>Chương {chapter.order}</span>
              <h2>{chapter.title.replace(/^Chương \d+:\s*/, '')}</h2>
            </div>
            <div className="chapter-card__lessons">
              {chapter.lessons.map((lesson) => (
                <Link key={lesson.id} to={`/student/lessons/${lesson.id}`}>
                  <span className="lesson-link__copy">
                    <span>{lesson.title}</span>
                    <small>
                      {lesson.progress === 100 ? (
                        <>
                          <CheckCircle2 aria-hidden="true" size={14} /> Đã hoàn thành
                        </>
                      ) : (
                        `${lesson.progress}% đã đọc`
                      )}
                    </small>
                  </span>
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
