import { useCallback } from 'react'
import { ArrowRight, BookOpen, FileText, MessageCircleQuestion, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
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
import { questionRepository } from '../../services/appRepositories'

export default function ClassPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const loader = useCallback(async () => {
    const courseClass = await classRepository.getById(classId, {
      lecturerId: currentLecturer.id,
    })
    const [students, metrics, lessons, materials, questions] = await Promise.all([
      classRepository.listStudents(classId, { lecturerId: currentLecturer.id }),
      classRepository.getMetrics(classId, { lecturerId: currentLecturer.id }),
      classContentRepository.listLessons(classId),
      classContentRepository.listMaterials(classId),
      questionRepository.listForLecturer(currentLecturer.id, { classId }),
    ])
    return { courseClass, students, metrics, lessons, materials, questions }
  }, [classId, currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải lớp học…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const unansweredCount = data.questions.filter((item) => item.status === 'unanswered').length
  const tools = [
    {
      label: 'Sinh viên',
      description: `${data.students.length} sinh viên · ${data.metrics.attentionCount + data.metrics.inactiveCount} cần theo dõi`,
      count: data.students.length,
      icon: Users,
      to: `/lecturer/classes/${classId}/students`,
    },
    {
      label: 'Bài học',
      description: `${data.lessons.filter((item) => item.status === 'published').length} đã xuất bản`,
      count: data.lessons.length,
      icon: BookOpen,
      to: `/lecturer/classes/${classId}/lessons`,
    },
    {
      label: 'Học liệu',
      description: `${data.materials.filter((item) => item.status === 'published').length} đang công khai`,
      count: data.materials.length,
      icon: FileText,
      to: `/lecturer/classes/${classId}/materials`,
    },
    {
      label: 'Câu hỏi',
      description: `${unansweredCount} câu hỏi chờ trả lời`,
      count: data.questions.length,
      icon: MessageCircleQuestion,
      to: `/lecturer/classes/${classId}/questions`,
    },
  ]
  const studentsToWatch = data.students.filter((item) => item.status !== 'active')

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.semester}
        title={data.courseClass.name}
        description={data.courseClass.subject?.name}
        actions={
          <Link className="button button--primary" to={`/lecturer/classes/${classId}/questions`}>
            <MessageCircleQuestion aria-hidden="true" size={18} />
            Xử lý câu hỏi
          </Link>
        }
      />
      <ClassSubnav classId={classId} />

      <section className="stat-grid" aria-label="Tổng quan lớp">
        <article className="stat-card">
          <Users aria-hidden="true" />
          <div>
            <strong>{data.students.length}</strong>
            <span>Sinh viên</span>
          </div>
        </article>
        <article className="stat-card stat-card--attention">
          <MessageCircleQuestion aria-hidden="true" />
          <div>
            <strong>{unansweredCount}</strong>
            <span>Câu hỏi chờ trả lời</span>
          </div>
        </article>
      </section>

      <section className="section-stack" aria-labelledby="class-tools-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Tác vụ chính</p>
            <h2 id="class-tools-title">Quản lý lớp</h2>
          </div>
        </div>
        <div className="card-grid card-grid--four">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                className="content-card content-card--interactive"
                key={tool.label}
                to={tool.to}
              >
                <div className="content-card__topline">
                  <span className="content-card__icon">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <strong>{tool.count}</strong>
                </div>
                <h3>{tool.label}</h3>
                <p>{tool.description}</p>
                <span className="content-card__action">
                  Mở quản lý <ArrowRight aria-hidden="true" size={16} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="section-stack" aria-labelledby="students-watch-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Ưu tiên hỗ trợ</p>
            <h2 id="students-watch-title">Sinh viên cần theo dõi</h2>
          </div>
          <Link className="text-link" to={`/lecturer/classes/${classId}/students`}>
            Xem danh sách <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        {studentsToWatch.length === 0 ? (
          <EmptyState
            title="Không có cảnh báo sinh viên"
            description="Tất cả sinh viên đang hoạt động bình thường."
          />
        ) : (
          <div className="compact-list">
            {studentsToWatch.map((student) => (
              <article className="compact-list__item" key={student.id}>
                <div>
                  <strong>{student.name}</strong>
                  <span>{student.email}</span>
                </div>
                <span>{student.progress}% tiến độ</span>
                <StatusLabel type={student.status} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
