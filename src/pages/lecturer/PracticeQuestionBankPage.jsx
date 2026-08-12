import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import ClassSubnav from '../../components/lecturer/ClassSubnav'
import { classRepository, practiceQuestionRepository } from '../../services/appRepositories'
import useAsyncData from '../../hooks/useAsyncData'
import './PracticeQuestionBankPage.css'

const statusLabels = {
  all: 'Tất cả',
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
}

export default function PracticeQuestionBankPage() {
  const { classId } = useParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const loader = useCallback(async () => {
    const filters = { query, status, page, pageSize: 12 }
    const [questions, courseClass] = await Promise.all([
      classId
        ? practiceQuestionRepository.listForClass(classId, filters)
        : practiceQuestionRepository.listForLecturer(filters),
      classId ? classRepository.getById(classId) : Promise.resolve(null),
    ])
    return { questions, courseClass }
  }, [classId, query, status, page])
  const { data, loading, error, reload } = useAsyncData(loader)
  const questionData = data?.questions
  const items = Array.isArray(questionData) ? questionData : (questionData?.items ?? [])
  const total = Array.isArray(questionData)
    ? questionData.length
    : (questionData?.total ?? items.length)
  const pageSize = Array.isArray(questionData) ? 12 : (questionData?.pageSize ?? 12)
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const counts = Array.isArray(questionData)
    ? {
        draft: items.filter((question) => question.status === 'draft').length,
        published: items.filter((question) => question.status === 'published').length,
        archived: items.filter((question) => question.status === 'archived').length,
      }
    : (questionData?.counts ?? { draft: 0, published: 0, archived: 0 })
  const creationQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''

  const runAction = async (questionId, action, successMessage) => {
    setBusyId(questionId)
    setActionError('')
    setActionNotice('')
    try {
      await action(questionId)
      setActionNotice(successMessage)
      await reload()
    } catch (actionFailure) {
      setActionError(actionFailure.message ?? 'Không thể cập nhật câu hỏi. Vui lòng thử lại.')
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <LoadingState label="Đang tải ngân hàng câu hỏi…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack practice-bank-page">
      <PageHeader
        eyebrow={data.courseClass?.name ?? 'Giảng viên'}
        title={classId ? 'Câu hỏi ôn tập của lớp' : 'Ngân hàng câu hỏi'}
        description="Câu hỏi dùng chung của học phần chỉ để tham khảo; câu hỏi riêng do bạn tạo được phân phối theo lớp tín chỉ."
        actions={
          <div className="button-group">
            <Link
              className="button button--secondary"
              to={`/lecturer/practice-questions/import${creationQuery}`}
            >
              <Upload aria-hidden="true" size={18} />
              Nhập từ CSV
            </Link>
            <Link
              className="button button--primary"
              to={`/lecturer/practice-questions/new${creationQuery}`}
            >
              <Plus aria-hidden="true" size={18} />
              Tạo câu hỏi
            </Link>
          </div>
        }
      />
      {classId && <ClassSubnav classId={classId} />}

      {actionNotice && (
        <p className="practice-bank-feedback practice-bank-feedback--success" role="status">
          {actionNotice}
        </p>
      )}
      {actionError && (
        <p className="practice-bank-feedback practice-bank-feedback--error" role="alert">
          {actionError}
        </p>
      )}

      <section className="practice-bank-summary" aria-label="Tổng quan ngân hàng câu hỏi">
        {Object.entries(statusLabels).map(([key, label]) => (
          <button
            className={`practice-stat ${status === key ? 'is-active' : ''}`}
            key={key}
            type="button"
            aria-pressed={status === key}
            onClick={() => {
              setStatus(key)
              setPage(1)
            }}
          >
            <span>{label}</span>
            <strong>{key === 'all' ? total : counts[key]}</strong>
          </button>
        ))}
      </section>

      <section className="practice-toolbar" aria-label="Bộ lọc câu hỏi">
        <label className="practice-search">
          <span className="sr-only">Tìm câu hỏi</span>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo nội dung câu hỏi…"
          />
        </label>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          aria-label="Lọc trạng thái"
        >
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </section>

      {items.length === 0 ? (
        <EmptyState
          title="Chưa có câu hỏi phù hợp"
          description="Tạo câu hỏi đầu tiên hoặc thay đổi bộ lọc hiện tại."
          action={
            <Link
              className="button button--secondary"
              to={`/lecturer/practice-questions/new${creationQuery}`}
            >
              Tạo câu hỏi
            </Link>
          }
        />
      ) : (
        <section className="practice-question-list" aria-label="Danh sách câu hỏi">
          {items.map((question) => (
            <article className="practice-question-card" key={question.id}>
              <div className="practice-question-card__topline">
                <div className="practice-question-card__badges">
                  <span className={`practice-status practice-status--${question.status}`}>
                    {question.status === 'published' && <Check aria-hidden="true" size={14} />}
                    {statusLabels[question.status]}
                  </span>
                  <span className={`practice-scope practice-scope--${question.scope}`}>
                    {question.scope === 'subject_shared' ? 'Dùng chung toàn môn' : 'Của tôi'}
                  </span>
                </div>
                <span className="practice-question-card__meta">
                  {question.subject?.name} · {question.chapter?.title}
                </span>
              </div>
              <h2>{question.content}</h2>
              <div className="practice-question-card__options">
                {question.options.map((option) => (
                  <span
                    className={option.id === question.correctOptionId ? 'is-correct' : ''}
                    key={option.id}
                  >
                    <b>{option.key}</b> {option.content}
                  </span>
                ))}
              </div>
              <div className="practice-question-card__footer">
                <span>
                  {question.scope === 'subject_shared'
                    ? `Quản trị viên · ${question.creatorName}`
                    : `${question.sourceType === 'csv' ? 'Nhập từ CSV' : 'Tạo thủ công'} · ${
                        question.classAssignments.map((item) => item.classCode).join(', ') ||
                        'Chưa gán lớp'
                      }`}
                </span>
                <div className="practice-question-card__actions">
                  {question.canEdit !== false && question.status !== 'archived' && (
                    <Link
                      className="button button--ghost"
                      to={`/lecturer/practice-questions/${question.id}/edit`}
                    >
                      <Edit3 aria-hidden="true" size={16} />
                      Sửa
                    </Link>
                  )}
                  {question.canEdit !== false && question.status === 'draft' && (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busyId === question.id}
                      onClick={() =>
                        runAction(
                          question.id,
                          practiceQuestionRepository.publish,
                          'Đã xuất bản câu hỏi.',
                        )
                      }
                    >
                      <Check aria-hidden="true" size={16} />
                      Xuất bản
                    </button>
                  )}
                  {question.canEdit !== false && question.status === 'archived' && (
                    <>
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={busyId === question.id}
                        onClick={() =>
                          runAction(
                            question.id,
                            practiceQuestionRepository.restore,
                            'Đã khôi phục câu hỏi về bản nháp.',
                          )
                        }
                      >
                        <Undo2 aria-hidden="true" size={16} />
                        Khôi phục
                      </button>
                      <button
                        className="button button--danger-ghost"
                        type="button"
                        disabled={busyId === question.id}
                        onClick={() => {
                          if (window.confirm('Xóa vĩnh viễn câu hỏi này?')) {
                            void runAction(
                              question.id,
                              practiceQuestionRepository.remove,
                              'Đã xóa vĩnh viễn câu hỏi.',
                            )
                          }
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                        Xóa
                      </button>
                    </>
                  )}
                  {question.canEdit !== false && question.status === 'published' && (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busyId === question.id}
                      onClick={() =>
                        runAction(
                          question.id,
                          practiceQuestionRepository.archive,
                          'Đã lưu trữ câu hỏi.',
                        )
                      }
                    >
                      <Archive aria-hidden="true" size={16} />
                      Lưu trữ
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      {total > 0 && (
        <nav className="practice-bank-pagination" aria-label="Phân trang ngân hàng câu hỏi">
          <span>
            Trang {page} / {totalPages}
          </span>
          <div>
            <button
              className="button button--ghost"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft aria-hidden="true" size={16} />
              Trước
            </button>
            <button
              className="button button--ghost"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Sau
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
