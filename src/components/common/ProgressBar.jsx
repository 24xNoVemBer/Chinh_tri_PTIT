import './ProgressBar.css'

export default function ProgressBar({ value, size = 'md', label = 'Tiến độ' }) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={`progressbar progressbar--${size}`}>
      <div
        className="progressbar__fill"
        style={{ width: `${clampedValue}%` }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={clampedValue}
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </div>
  )
}
