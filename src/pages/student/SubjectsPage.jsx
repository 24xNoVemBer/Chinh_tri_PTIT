import { useCallback } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ProgressBar from '../../components/common/ProgressBar'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { learningRepository } from '../../services/appRepositories'

export default function SubjectsPage() {
  const { user: currentStudent } = useAuth()
  const loader = useCallback(
    () => learningRepository.listSubjectProgress(currentStudent.id),
    [currentStudent.id],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải danh sách môn…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Sinh viên"
        title="Môn học"
        description="Chọn một môn để xem chương, bài học, tiến độ và các công cụ hỏi đáp liên quan."
      />
      {data.length === 0 ? (
        <EmptyState title="Chưa có môn học" description="Bạn chưa được ghi danh vào môn học nào." />
      ) : (
        <div className="card-grid card-grid--three">
          {data.map((subject) => (
            <Link
              className="content-card content-card--interactive subject-card"
              key={subject.id}
              to={`/student/subjects/${subject.id}`}
            >
              <span className="content-card__meta">{subject.credits} tín chỉ</span>
              <h2>{subject.name}</h2>
              <p>
                {subject.completedLessons}/{subject.lessonCount} bài học đã hoàn thành
              </p>
              <div className="subject-card__progress">
                <ProgressBar value={subject.progress} label={`Tiến độ ${subject.progress}%`} />
                <span>{subject.progress}%</span>
              </div>
              <span className="content-card__action">
                Xem môn học <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
