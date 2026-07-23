import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <p className="page-header__eyebrow">404</p>
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này chưa tồn tại hoặc đã được thay đổi.</p>
      <Link className="button button--primary" to="/">
        <ArrowLeft aria-hidden="true" size={18} />
        Về trang chọn vai trò
      </Link>
    </main>
  )
}
