import { BarChart3, BookOpenCheck, Target, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository, practiceAnalyticsRepository } from '../../services/appRepositories'
import './PracticeAnalyticsPage.css'

export default function PracticeAnalyticsPage() {
  const { user } = useAuth()
  const [selectedClassId, setSelectedClassId] = useState('')
  const loader = useCallback(async () => {
    const classes = await classRepository.listForLecturer(user.id)
    const classId = selectedClassId || classes[0]?.id
    const analytics = classId ? await practiceAnalyticsRepository.getForLecturer({ classId }) : null
    return { classes, analytics }
  }, [selectedClassId, user.id])
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
  }
  const maxChapterAttempts = Math.max(
    ...(analytics?.byChapter ?? []).map((item) => item.answered),
    1,
  )

  return (
    <div className="page-stack practice-analytics-page">
      <PageHeader
        eyebrow="Giảng viên"
        title="Phân tích luyện tập"
        description="Theo dõi mức độ tham gia, độ chính xác và các chủ đề cần củng cố theo từng lớp."
        actions={
          <select
            className="practice-analytics-class-select"
            value={selectedClassId || data.classes[0].id}
            onChange={(event) => setSelectedClassId(event.target.value)}
            aria-label="Chọn lớp phân tích"
          >
            {data.classes.map((courseClass) => (
              <option key={courseClass.id} value={courseClass.id}>
                {courseClass.name}
              </option>
            ))}
          </select>
        }
      />

      <section className="practice-analytics-summary" aria-label="Tổng quan luyện tập">
        <Metric
          icon={Users}
          label="Sinh viên tham gia"
          value={summary.activeStudentCount}
          detail={`${summary.studentCount} sinh viên trong lớp`}
        />
        <Metric
          icon={BookOpenCheck}
          label="Phiên luyện tập"
          value={summary.attemptCount}
          detail={`${summary.completedCount} phiên đã hoàn thành`}
        />
        <Metric
          icon={Target}
          label="Độ chính xác"
          value={`${summary.accuracy}%`}
          detail={`${summary.answeredCount} câu đã có đáp án`}
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
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="practice-analytics-metric">
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
