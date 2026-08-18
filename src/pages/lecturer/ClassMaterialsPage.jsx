import { useCallback, useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useParams } from 'react-router-dom'
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

export default function ClassMaterialsPage() {
  const { user: currentLecturer } = useAuth()
  const { classId } = useParams()
  const [materialId, setMaterialId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackError, setFeedbackError] = useState(false)
  const [formError, setFormError] = useState('')

  const loader = useCallback(async () => {
    const courseClass = await classRepository.getById(classId, {
      lecturerId: currentLecturer.id,
    })
    const [classMaterials, availableMaterials] = await Promise.all([
      classContentRepository.listMaterials(classId),
      classContentRepository.listAvailableMaterials(classId),
    ])
    return { courseClass, classMaterials, availableMaterials }
  }, [classId, currentLecturer.id])
  const { data, loading, error, reload } = useAsyncData(loader)

  if (loading) return <LoadingState label="Đang tải học liệu…" />
  if (error?.code === 'FORBIDDEN') return <PermissionState message={error.message} />
  if (error) return <ErrorState message={error.message} onRetry={reload} />
  if (!data.courseClass) return <EmptyState title="Không tìm thấy lớp học" />

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!materialId) {
      setFormError('Hãy chọn một học liệu.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    setFeedbackError(false)
    setFormError('')
    try {
      await classContentRepository.attachMaterial(classId, { materialId })
      setMaterialId('')
      setFeedback('Đã gắn học liệu vào lớp ở trạng thái bản nháp.')
      await reload()
    } catch (submitError) {
      setFormError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (classMaterial, nextStatus) => {
    setUpdatingId(classMaterial.id)
    setFeedback('')
    setFeedbackError(false)
    try {
      await classContentRepository.updateMaterialStatus(classId, classMaterial.id, nextStatus)
      setFeedback(
        nextStatus === 'published'
          ? 'Đã công khai học liệu cho sinh viên.'
          : 'Đã chuyển học liệu về bản nháp.',
      )
      await reload()
    } catch (updateError) {
      setFeedback(updateError.message ?? 'Không thể cập nhật trạng thái học liệu.')
      setFeedbackError(true)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data.courseClass.name}
        title="Học liệu của lớp"
        description="Gắn nguồn đã được phê duyệt và kiểm soát nội dung sinh viên có thể truy cập."
      />
      <ClassSubnav classId={classId} />

      <section className="management-grid">
        <form className="form-surface management-form" onSubmit={handleSubmit}>
          <div>
            <p className="section-heading__eyebrow">Nguồn đã duyệt</p>
            <h2>Gắn học liệu</h2>
          </div>
          <div className="field-group">
            <label htmlFor="material-option">Học liệu</label>
            <select
              id="material-option"
              value={materialId}
              onChange={(event) => setMaterialId(event.target.value)}
              aria-describedby="material-option-hint"
            >
              <option value="">Chọn học liệu phù hợp với môn</option>
              {data.availableMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.title} · {material.author}
                </option>
              ))}
            </select>
            <p className="field-hint" id="material-option-hint">
              Chỉ hiển thị nguồn đã được đánh dấu phê duyệt.
            </p>
          </div>
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting || data.availableMaterials.length === 0}
          >
            <Plus aria-hidden="true" size={18} />
            {submitting ? 'Đang gắn…' : 'Gắn vào lớp'}
          </button>
        </form>

        <section className="section-stack" aria-labelledby="class-materials-title">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Đang sử dụng</p>
              <h2 id="class-materials-title">{data.classMaterials.length} học liệu</h2>
            </div>
          </div>
          {feedback && (
            <div
              className={`feedback-banner ${feedbackError ? 'feedback-banner--error' : ''}`}
              role={feedbackError ? 'alert' : 'status'}
              aria-live="polite"
            >
              {feedback}
            </div>
          )}
          {data.classMaterials.length === 0 ? (
            <EmptyState
              title="Chưa có học liệu"
              description="Hãy gắn nguồn đầu tiên cho lớp học."
            />
          ) : (
            <div className="management-list">
              {data.classMaterials.map((classMaterial) => (
                <article className="management-item" key={classMaterial.id}>
                  <span className="management-item__icon">
                    <FileText aria-hidden="true" size={20} />
                  </span>
                  <div className="management-item__body">
                    <div className="management-item__meta">
                      <StatusLabel type={classMaterial.status} />
                      <span>Phiên bản {classMaterial.version?.year}</span>
                    </div>
                    <h3>{classMaterial.material?.title}</h3>
                    <p>{classMaterial.material?.author}</p>
                  </div>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={updatingId === classMaterial.id}
                    onClick={() =>
                      handleStatusChange(
                        classMaterial,
                        classMaterial.status === 'published' ? 'draft' : 'published',
                      )
                    }
                  >
                    {classMaterial.status === 'published' ? 'Ẩn khỏi lớp' : 'Công khai'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
