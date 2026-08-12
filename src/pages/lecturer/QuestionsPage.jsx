import { useCallback, useDeferredValue, useState } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
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
import { classRepository, questionRepository } from '../../services/appRepositories'

export default function QuestionsPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const [query, setQuery] = useState('')
  const [routingStatus, setRoutingStatus] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')
  const deferredQuery = useDeferredValue(query)

  const loader = useCallback(async () => {
    const [courseClass, queue] = await Promise.all([
      classRepository.getById(classId, { lecturerId: currentLecturer.id }),
      questionRepository.listQueue(classId, {
        query: deferredQuery,
        routingStatus,
        status: 'all',
      }),
    ])
    return { courseClass, queue }
  }, [classId, currentLecturer.id, deferredQuery, routingStatus])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải câu hỏi của lớp…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const visibleQuestions = data.queue.items

  const updateClaim = async (question, action) => {
    setBusyId(question.id)
    setActionError('')
    try {
      await action(question.id, classId)
      await reload()
    } catch (cause) {
      setActionError(cause.message ?? 'Không thể cập nhật người xử lý câu hỏi.')
      await reload()
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Hàng đợi hỏi đáp"
        description="Các giảng viên cùng lớp nhìn thấy một hàng đợi chung; mỗi câu hỏi chỉ có một người nhận xử lý tại một thời điểm."
      />
      <ClassSubnav classId={classId} />
      {data.queue.leadAlert && (
        <div className="feedback-banner feedback-banner--warning" role="alert">
          <AlertTriangle aria-hidden="true" size={19} />
          <span>
            Có {data.queue.overdueCount} câu hỏi quá {data.queue.slaHours} giờ chưa được trả lời.
            Giảng viên phụ trách chính cần điều phối xử lý.
          </span>
        </div>
      )}
      {actionError && (
        <p className="field-error" role="alert">
          {actionError}
        </p>
      )}
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
              value={routingStatus}
              onChange={(event) => setRoutingStatus(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="queued">Chưa có người nhận</option>
              <option value="claimed">Đang xử lý</option>
              <option value="answered">Đã trả lời</option>
            </select>
          </div>
        </div>
        <QuestionList
          questions={visibleQuestions}
          emptyTitle="Không có câu hỏi phù hợp"
          emptyDescription="Hãy thay đổi từ khóa hoặc trạng thái."
          currentUserId={currentLecturer.id}
          busyId={busyId}
          onClaim={(question) => updateClaim(question, questionRepository.claim)}
          onRelease={(question) => updateClaim(question, questionRepository.release)}
        />
      </section>
    </div>
  )
}
