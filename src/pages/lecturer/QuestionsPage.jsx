import { useCallback, useDeferredValue, useState } from 'react'
import { Search } from 'lucide-react'
import { useParams } from 'react-router-dom'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import QuestionList from '../../components/lecturer/QuestionList'
import { useAuth } from '../../features/auth/useAuth'
import useAsyncData from '../../hooks/useAsyncData'
import { classRepository } from '../../services/appRepositories'
import { questionRepository } from '../../services/appRepositories'
import { includesNormalized } from '../../utils/text'

export default function QuestionsPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const deferredQuery = useDeferredValue(query)

  const loader = useCallback(async () => {
    const [courseClass, questions] = await Promise.all([
      classRepository.getById(classId, { lecturerId: currentLecturer.id }),
      questionRepository.listForLecturer(currentLecturer.id, { classId }),
    ])
    return { courseClass, questions }
  }, [classId, currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải câu hỏi của lớp…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const visibleQuestions = data.questions.filter((question) => {
    if (status !== 'all' && question.status !== status) return false
    if (
      deferredQuery &&
      !includesNormalized(question.content, deferredQuery) &&
      !includesNormalized(question.student?.name, deferredQuery)
    ) {
      return false
    }
    return true
  })

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Câu hỏi của lớp"
        description="Theo dõi và trả lời câu hỏi trong đúng ngữ cảnh môn học."
      />
      <ClassSubnav classId={classId} />
      <section className="section-stack" aria-labelledby="class-question-list-title">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Hỏi đáp</p>
            <h2 id="class-question-list-title">{visibleQuestions.length} câu hỏi</h2>
          </div>
        </div>
        <div className="filter-toolbar">
          <div className="filter-field filter-field--search">
            <label htmlFor="class-question-query">Tìm câu hỏi</label>
            <div className="filter-field__control">
              <Search aria-hidden="true" size={18} />
              <input
                id="class-question-query"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nội dung hoặc tên sinh viên"
              />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="class-question-status">Trạng thái</label>
            <select
              id="class-question-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unanswered">Chờ trả lời</option>
              <option value="answered">Đã trả lời</option>
            </select>
          </div>
        </div>
        <QuestionList
          questions={visibleQuestions}
          emptyTitle="Không có câu hỏi phù hợp"
          emptyDescription="Hãy thay đổi từ khóa hoặc trạng thái."
        />
      </section>
    </div>
  )
}
