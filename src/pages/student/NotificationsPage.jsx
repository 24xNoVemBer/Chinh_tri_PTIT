import { EmptyState } from '../../components/common/AsyncState'
import PageHeader from '../../components/common/PageHeader'

export default function NotificationsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Sinh viên"
        title="Thông báo"
        description="Cập nhật từ các lớp và câu hỏi của bạn."
      />
      <EmptyState
        title="Chưa có thông báo mới"
        description="Các cập nhật quan trọng sẽ xuất hiện tại đây."
      />
    </div>
  )
}
