import { Archive, Check, Edit3, Plus, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'
import { practiceQuestionRepository } from '../../services/appRepositories'
import useAsyncData from '../../hooks/useAsyncData'
import './PracticeQuestionBankPage.css'

const statusLabels = {
  all: 'Tất cả',
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
}

export default function PracticeQuestionBankPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState('')
  const loader = useCallback(
    () => practiceQuestionRepository.listForLecturer({ query, status }),
    [query, status],
  )
  const { data, loading, error, reload } = useAsyncData(loader)

  const runAction = async (questionId, action) => {
    setBusyId(questionId)
    try {
      await action(questionId)
      await reload()
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <LoadingState label="Đang tải ngân hàng câu hỏi…" />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <div className="page-stack practice-bank-page">
      <PageHeader
        eyebrow="Giảng viên"
        title="Ngân hàng câu hỏi"
        description="Tạo, kiểm tra và xuất bản câu hỏi luyện tập theo từng học phần."
        actions={
          <Link className="button button--primary" to="/lecturer/practice-questions/new">
            <Plus aria-hidden="true" size={18} />
            Tạo câu hỏi
          </Link>
        }
      />

      <section className="practice-bank-summary" aria-label="Tổng quan ngân hàng câu hỏi">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div className="practice-stat" key={key}>
            <span>{label}</span>
            <strong>
              {key === 'all'
                ? data.length
                : data.filter((question) => question.status === key).length}
            </strong>
          </div>
        ))}
      </section>

      <section className="practice-toolbar" aria-label="Bộ lọc câu hỏi">
        <label className="practice-search">
          <span className="sr-only">Tìm câu hỏi</span>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo nội dung câu hỏi…"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Lọc trạng thái"
        >
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </section>

      {data.length === 0 ? (
        <EmptyState
          title="Chưa có câu hỏi phù hợp"
          description="Tạo câu hỏi đầu tiên hoặc thay đổi bộ lọc hiện tại."
          action={
            <Link className="button button--secondary" to="/lecturer/practice-questions/new">
              Tạo câu hỏi
            </Link>
          }
        />
      ) : (
        <section className="practice-question-list" aria-label="Danh sách câu hỏi">
          {data.map((question) => (
            <article className="practice-question-card" key={question.id}>
              <div className="practice-question-card__topline">
                <span className={`practice-status practice-status--${question.status}`}>
                  {question.status === 'published' && <Check aria-hidden="true" size={14} />}
                  {statusLabels[question.status]}
                </span>
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
                <span>Độ khó: {question.difficulty}</span>
                <div className="practice-question-card__actions">
                  {question.status !== 'archived' && (
                    <Link
                      className="button button--ghost"
                      to={`/lecturer/practice-questions/${question.id}/edit`}
                    >
                      <Edit3 aria-hidden="true" size={16} />
                      Sửa
                    </Link>
                  )}
                  {question.status === 'draft' && (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busyId === question.id}
                      onClick={() => runAction(question.id, practiceQuestionRepository.publish)}
                    >
                      <Check aria-hidden="true" size={16} />
                      Xuất bản
                    </button>
                  )}
                  {question.status === 'published' && (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={busyId === question.id}
                      onClick={() => runAction(question.id, practiceQuestionRepository.archive)}
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
    </div>
  )
}
