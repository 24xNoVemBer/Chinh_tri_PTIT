import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Clock3,
  GraduationCap,
  MessageCircleQuestion,
  Target,
  Users,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import {
  adminRepository,
  classRepository,
  practiceAnalyticsRepository,
} from '../../services/appRepositories'
import { formatDateTime } from '../../utils/format'
import './PracticeAnalyticsPage.css'

export default function PracticeAnalyticsPage() {
  const { classId: routeClassId } = useParams()
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [selectedClassId, setSelectedClassId] = useState('')
  const loader = useCallback(async () => {
    const classes = isAdmin
      ? await adminRepository.listClasses({ status: 'active' })
      : await classRepository.listForLecturer(user.id)
    const classId = routeClassId || selectedClassId || classes[0]?.id
    const analytics = classId
      ? isAdmin
        ? await adminRepository.getClassAnalytics(classId)
        : await practiceAnalyticsRepository.getForClass(classId)
      : null
    return { classes, analytics }
  }, [isAdmin, routeClassId, selectedClassId, user.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải phân tích luyện tập…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data?.classes.length) {
    return (
      <EmptyState
        title="Chưa có lớp để phân tích"
        description="Tạo hoặc nhận lớp trước khi xem thống kê luyện tập."
      />
    )
  }

  const analytics = data.analytics
  const summary = analytics?.summary ?? {
    studentCount: 0,
    activeStudentCount: 0,
    attemptCount: 0,
    completedCount: 0,
    answeredCount: 0,
    accuracy: 0,
    averageScore: 0,
    participationRate: 0,
    practiceAttemptCount: 0,
    mockExamAttemptCount: 0,
    lecturerCount: 0,
  }
  const maxChapterAttempts = Math.max(
    ...(analytics?.byChapter ?? []).map((item) => item.answered),
    1,
  )

  return (
    <div className="page-stack practice-analytics-page">
      <PageHeader
        eyebrow={isAdmin ? 'Quản trị viên' : 'Giảng viên'}
        title="Thống kê lớp tín chỉ"
        description="Theo dõi luyện tập, thi thử, sinh viên cần hỗ trợ và vận hành hỏi đáp trong đúng phạm vi từng lớp."
        actions={
          routeClassId ? null : (
            <select
              className="practice-analytics-class-select"
              value={selectedClassId || data.classes[0].id}
              onChange={(event) => setSelectedClassId(event.target.value)}
              aria-label="Chọn lớp phân tích"
            >
              {data.classes.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.classCode ? `${courseClass.classCode} · ` : ''}
                  {courseClass.name}
                </option>
              ))}
            </select>
          )
        }
      />
      {routeClassId && <ClassSubnav classId={routeClassId} />}

      <section className="practice-analytics-summary" aria-label="Tổng quan luyện tập">
        <Metric
          icon={Users}
          label="Sinh viên tham gia"
          value={summary.activeStudentCount}
          detail={`${summary.participationRate}% trong ${summary.studentCount} sinh viên`}
        />
        <Metric
          icon={BookOpenCheck}
          label="Phiên luyện tập"
          value={summary.attemptCount}
          detail={`${summary.practiceAttemptCount} luyện tập · ${summary.mockExamAttemptCount} thi thử`}
        />
        <Metric
          icon={Target}
          label="Điểm trung bình"
          value={`${summary.averageScore}%`}
          detail={`${summary.accuracy}% đúng trên ${summary.answeredCount} lượt trả lời`}
        />
        <Metric
          icon={MessageCircleQuestion}
          label="Hỏi đáp đang chờ"
          value={analytics?.qna.pending ?? 0}
          detail={`${analytics?.qna.answered ?? 0} câu đã trả lời`}
        />
        <Metric
          icon={Clock3}
          label="Quá SLA"
          value={analytics?.qna.overdue ?? 0}
          detail={`Phản hồi trung bình ${analytics?.qna.averageResponseHours ?? 0} giờ`}
          tone={(analytics?.qna.overdue ?? 0) > 0 ? 'warning' : 'default'}
        />
        <Metric
          icon={GraduationCap}
          label="Giảng viên"
          value={summary.lecturerCount}
          detail="Đang được phân công trong lớp"
        />
      </section>

      <div className="practice-analytics-grid">
        <section className="practice-analytics-panel" aria-labelledby="practice-chapters-title">
          <div className="practice-analytics-panel__heading">
            <div>
              <p className="section-heading__eyebrow">Theo chủ đề</p>
              <h2 id="practice-chapters-title">Mức độ ôn tập</h2>
            </div>
            <BarChart3 aria-hidden="true" size={20} />
          </div>
          {analytics?.byChapter?.length ? (
            <div className="practice-analytics-chapters">
              {analytics.byChapter.map((item) => (
                <div className="practice-analytics-chapter" key={item.chapterId ?? 'unknown'}>
                  <div>
                    <strong>{item.chapterTitle ?? item.chapterId ?? 'Không gắn chương'}</strong>
                    <span>
                      {item.answered} câu · {item.accuracy}% đúng
                    </span>
                  </div>
                  <div className="practice-analytics-bar" aria-hidden="true">
                    <span style={{ width: `${(item.answered / maxChapterAttempts) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="practice-analytics-empty">Chưa có dữ liệu luyện tập cho lớp này.</p>
          )}
        </section>

        <section className="practice-analytics-panel" aria-labelledby="practice-questions-title">
          <div className="practice-analytics-panel__heading">
            <div>
              <p className="section-heading__eyebrow">Cần chú ý</p>
              <h2 id="practice-questions-title">Câu hỏi có tỷ lệ sai cao</h2>
            </div>
          </div>
          {analytics?.questions?.length ? (
            <div className="practice-analytics-question-list">
              {analytics.questions.slice(0, 5).map((item) => (
                <article key={item.questionId}>
                  <strong>{item.content}</strong>
                  <span>
                    {item.accuracy}% đúng · {item.attempts} lượt trả lời
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="practice-analytics-empty">Chưa đủ mẫu để xếp hạng câu hỏi.</p>
          )}
        </section>
        <section className="practice-analytics-panel" aria-labelledby="practice-students-title">
          <div className="practice-analytics-panel__heading">
            <div>
              <p className="section-heading__eyebrow">Cần hỗ trợ</p>
              <h2 id="practice-students-title">Sinh viên cần theo dõi</h2>
            </div>
            <AlertTriangle aria-hidden="true" size={20} />
          </div>
          {analytics?.students?.some((item) => item.participationStatus !== 'on_track') ? (
            <div className="practice-analytics-student-list">
              {analytics.students
                .filter((item) => item.participationStatus !== 'on_track')
                .slice(0, 8)
                .map((student) => (
                  <article key={`${student.classId}-${student.id}`}>
                    <div>
                      <strong>{student.name}</strong>
                      <span>{student.email}</span>
                    </div>
                    <div className="practice-analytics-student-result">
                      <span
                        className={`analytics-state analytics-state--${student.participationStatus}`}
                      >
                        {student.participationStatus === 'not_started'
                          ? 'Chưa tham gia'
                          : 'Cần củng cố'}
                      </span>
                      <small>
                        {student.sessionCount} phiên · {student.accuracy}% đúng
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p className="practice-analytics-empty">Không có sinh viên cần cảnh báo.</p>
          )}
        </section>

        <section className="practice-analytics-panel" aria-labelledby="lecturer-activity-title">
          <div className="practice-analytics-panel__heading">
            <div>
              <p className="section-heading__eyebrow">Phối hợp giảng dạy</p>
              <h2 id="lecturer-activity-title">Hoạt động giảng viên</h2>
            </div>
            <Users aria-hidden="true" size={20} />
          </div>
          {analytics?.lecturerActivity?.length ? (
            <div className="practice-analytics-lecturer-list">
              {analytics.lecturerActivity.map((lecturer) => (
                <article key={lecturer.id}>
                  <div>
                    <strong>{lecturer.name}</strong>
                    <span>
                      {lecturer.assignmentRole === 'lead' ? 'Phụ trách chính' : 'Giảng viên'}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Đang nhận</dt>
                      <dd>{lecturer.openClaims}</dd>
                    </div>
                    <div>
                      <dt>Đã trả lời</dt>
                      <dd>{lecturer.answeredCount}</dd>
                    </div>
                    <div>
                      <dt>Phản hồi TB</dt>
                      <dd>{lecturer.averageResponseHours} giờ</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="practice-analytics-empty">Lớp chưa có giảng viên đang hoạt động.</p>
          )}
        </section>
      </div>

      <p className="practice-analytics-updated">
        Dữ liệu được tổng hợp trực tiếp theo lớp
        {analytics?.courseClass ? ` ${analytics.courseClass.classCode}` : ''}
        {analytics?.students?.some((item) => item.lastActiveAt)
          ? ` · Hoạt động gần nhất ${formatDateTime(
              analytics.students
                .map((item) => item.lastActiveAt)
                .filter(Boolean)
                .sort()
                .at(-1),
            )}`
          : ''}
      </p>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, tone = 'default' }) {
  return (
    <article className={`practice-analytics-metric practice-analytics-metric--${tone}`}>
      <span className="practice-analytics-metric__icon">
        <Icon aria-hidden="true" size={20} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}
