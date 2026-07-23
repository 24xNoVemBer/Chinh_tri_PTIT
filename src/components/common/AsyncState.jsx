import { AlertCircle, Inbox, ShieldAlert } from 'lucide-react'

export function LoadingState({ label = 'Đang tải dữ liệu…' }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="state-panel__loader" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ message = 'Không thể tải dữ liệu.', onRetry }) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <AlertCircle aria-hidden="true" size={24} />
      <p>{message}</p>
      {onRetry && (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  )
}

export function PermissionState({ message = 'Bạn không có quyền truy cập nội dung này.' }) {
  return (
    <div className="state-panel state-panel--warning" role="alert">
      <ShieldAlert aria-hidden="true" size={26} />
      <h2>Không có quyền truy cập</h2>
      <p>{message}</p>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="state-panel">
      <Inbox aria-hidden="true" size={28} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
