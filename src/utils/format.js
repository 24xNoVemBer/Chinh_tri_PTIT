export function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDate(value) {
  if (!value) return 'Chưa lên lịch'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatPercent(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100)
}
