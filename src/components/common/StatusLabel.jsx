import { Bot, Check, CircleAlert, Clock3, Library } from 'lucide-react'
import './StatusLabel.css'

const STATUS_CONFIG = {
  source: { label: 'Nguồn học liệu', icon: Library },
  ai: { label: 'RAG tổng hợp', icon: Bot },
  verified: { label: 'Đã duyệt', icon: Check },
  answered: { label: 'Đã trả lời', icon: Check },
  unanswered: { label: 'Chờ trả lời', icon: Clock3 },
  generated: { label: 'Chờ kiểm duyệt', icon: Clock3 },
  pending_review: { label: 'Chờ giảng viên duyệt', icon: Clock3 },
  approved: { label: 'Đã kiểm duyệt', icon: Check },
  rejected: { label: 'Không sử dụng', icon: CircleAlert },
  needs_revision: { label: 'Cần chỉnh sửa', icon: CircleAlert },
  failed: { label: 'Đã chuyển giảng viên', icon: CircleAlert },
  processing: { label: 'Đang tổng hợp', icon: Bot },
  active: { label: 'Đang học', icon: Check },
  attention: { label: 'Cần chú ý', icon: CircleAlert },
  inactive: { label: 'Ít hoạt động', icon: Clock3 },
  published: { label: 'Đã xuất bản', icon: Check },
  draft: { label: 'Bản nháp', icon: Clock3 },
}

export default function StatusLabel({ type, lecturerName }) {
  const config = STATUS_CONFIG[type]
  if (!config) return null

  const Icon = config.icon
  const suffix = type === 'verified' && lecturerName ? ` · ${lecturerName}` : ''

  return (
    <span className={`status-label status-label--${type}`}>
      <Icon aria-hidden="true" size={14} />
      {config.label}
      {suffix}
    </span>
  )
}
