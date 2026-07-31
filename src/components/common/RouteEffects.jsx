import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'PTIT Chính Trị'

// Longest prefix wins, so specific routes override their section.
const ROUTE_TITLES = [
  ['/student/subjects', 'Học phần'],
  ['/student/lessons', 'Bài học'],
  ['/student/questions', 'Hỏi đáp của tôi'],
  ['/student/notifications', 'Thông báo'],
  ['/student/search', 'Tra cứu học liệu'],
  ['/student/chat', 'AI trợ giảng'],
  ['/student', 'Tổng quan sinh viên'],
  ['/lecturer/classes', 'Lớp học'],
  ['/lecturer/questions', 'Hàng đợi câu hỏi'],
  ['/lecturer/review-queue', 'Kiểm duyệt RAG'],
  ['/lecturer', 'Tổng quan giảng viên'],
  ['/login', 'Đăng nhập'],
  ['/', 'Nền tảng học lý luận chính trị cho sinh viên PTIT'],
]

function titleForPath(pathname) {
  const match = ROUTE_TITLES.find(
    ([prefix]) => pathname === prefix || (prefix !== '/' && pathname.startsWith(prefix)),
  )
  return match ? `${match[1]} · ${SITE_NAME}` : SITE_NAME
}

export default function RouteEffects() {
  const { pathname } = useLocation()

  useEffect(() => {
    // 'instant' so the new page appears at the top immediately. Smooth scrolling made the
    // fresh content render at the previous scroll offset and then glide upwards.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])

  useEffect(() => {
    // A single-page app keeps the initial <title> forever unless it is set per route, which
    // breaks tab switching, bookmarks and browser history.
    document.title = titleForPath(pathname)
  }, [pathname])

  return null
}
