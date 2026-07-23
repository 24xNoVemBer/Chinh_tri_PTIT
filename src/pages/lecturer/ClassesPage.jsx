import { useCallback } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'

export default function ClassesPage() {
  const { user: currentLecturer } = useAuth()
  const loader = useCallback(
    () => classRepository.listForLecturer(currentLecturer.id),
    [currentLecturer.id],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải danh sách lớp…" />
  if (error) return <ErrorState onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Giảng viên"
        title="Lớp học"
        description="Các lớp bạn đang phụ trách trong học kỳ hiện tại."
      />
      {data.length === 0 ? (
        <EmptyState title="Chưa có lớp học" />
      ) : (
        <div className="card-grid card-grid--three">
          {data.map((courseClass) => (
            <Link
              className="content-card content-card--interactive"
              key={courseClass.id}
              to={`/lecturer/classes/${courseClass.id}`}
            >
              <span className="content-card__meta">{courseClass.semester}</span>
              <h2>{courseClass.name}</h2>
              <p>
                <Users aria-hidden="true" size={16} /> {courseClass.studentCount} sinh viên
              </p>
              <span className="content-card__action">
                Quản lý lớp <ArrowRight aria-hidden="true" size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
