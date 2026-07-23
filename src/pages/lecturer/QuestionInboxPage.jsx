import { useCallback, useDeferredValue, useState } from 'react'
import { CheckCircle2, CircleHelp, Search } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import QuestionList from '../../components/lecturer/QuestionList'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'
import { questionRepository } from '../../services/appRepositories'
import { includesNormalized } from '../../utils/text'

export default function QuestionInboxPage() {
  const { user: currentLecturer } = useAuth()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('unanswered')
  const [classId, setClassId] = useState('all')
  const deferredQuery = useDeferredValue(query)

  const loader = useCallback(async () => {
    const [classes, questions] = await Promise.all([
      classRepository.listForLecturer(currentLecturer.id),
      questionRepository.listForLecturer(currentLecturer.id),
    ])
    return { classes, questions }
  }, [currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải hộp câu hỏi…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  const visibleQuestions = data.questions.filter((question) => {
    if (status !== 'all' && question.status !== status) return false
    if (classId !== 'all' && question.courseClass?.id !== classId) return false
    if (
      deferredQuery &&
      !includesNormalized(question.content, deferredQuery) &&
      !includesNormalized(question.student?.name, deferredQuery)
    ) {
      return false
    }
    return true
  })
  const unansweredCount = data.questions.filter((item) => item.status === 'unanswered').length
  const answeredCount = data.questions.filter((item) => item.status === 'answered').length

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Giảng viên"
        title="Hộp câu hỏi"
        description="Lọc theo lớp và trạng thái, sau đó mở từng câu hỏi để trả lời thủ công."
      />

      <section className="stat-grid stat-grid--two" aria-label="Tình hình hỏi đáp">
        <article className="stat-card stat-card--attention">
          <CircleHelp aria-hidden="true" />
          <div>
            <strong>{unansweredCount}</strong>
            <span>Chờ trả lời</span>
          </div>
        </article>
        <article className="stat-card">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>{answeredCount}</strong>
            <span>Đã trả lời</span>
          </div>
        </article>
      </section>

      <section className="section-stack" aria-labelledby="inbox-list-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Cần xử lý</p>
            <h2 id="inbox-list-title">{visibleQuestions.length} câu hỏi</h2>
          </div>
        </div>
        <div className="filter-toolbar filter-toolbar--three">
          <div className="filter-field filter-field--search">
            <label htmlFor="question-query">Tìm câu hỏi</label>
            <div className="filter-field__control">
              <Search aria-hidden="true" size={18} />
              <input
                id="question-query"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nội dung hoặc tên sinh viên"
              />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="question-class">Lớp học</label>
            <select
              id="question-class"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="all">Tất cả lớp</option>
              {data.classes.map((courseClass) => (
                <option key={courseClass.id} value={courseClass.id}>
                  {courseClass.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="question-status">Trạng thái</label>
            <select
              id="question-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unanswered">Chờ trả lời</option>
              <option value="answered">Đã trả lời</option>
            </select>
          </div>
        </div>
        {data.questions.length === 0 ? (
          <EmptyState title="Không có câu hỏi" description="Các lớp hiện chưa gửi câu hỏi." />
        ) : (
          <QuestionList questions={visibleQuestions} />
        )}
      </section>
    </div>
  )
}
