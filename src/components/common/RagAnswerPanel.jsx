import { BookOpenText, Bot } from 'lucide-react'
import StatusLabel from './StatusLabel'

const STATUS_COPY = {
  pending_review: 'Bản tổng hợp này đang chờ giảng viên kiểm duyệt.',
  approved: 'Nội dung đã được giảng viên kiểm duyệt.',
  rejected: 'Bản tổng hợp này không được sử dụng làm câu trả lời.',
  needs_revision: 'Bản tổng hợp cần được chỉnh sửa trước khi sử dụng.',
}

export default function RagAnswerPanel({ response, compact = false }) {
  if (!response) return null

  return (
    <section
      className={`rag-answer${compact ? ' rag-answer--compact' : ''}`}
      aria-labelledby={compact ? undefined : `rag-answer-${response.id}`}
    >
      <div className="rag-answer__header">
        <span className="rag-answer__icon">
          <Bot aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="section-heading__eyebrow">
            {response.isDemo ? 'Dữ liệu demo · mô phỏng RAG' : 'RAG tổng hợp từ học liệu đã duyệt'}
          </p>
          {!compact && <h2 id={`rag-answer-${response.id}`}>Câu trả lời tham khảo</h2>}
        </div>
        <StatusLabel type={response.reviewStatus} />
      </div>

      <p className="rag-answer__content">{response.content}</p>

      {!compact && (
        <>
          <p className="rag-answer__disclosure">
            {STATUS_COPY[response.reviewStatus] ?? 'Nội dung do hệ thống RAG tạo.'}
            {response.modelVersion ? ` Mô hình: ${response.modelVersion}.` : ''}
          </p>

          <div className="citation-list" aria-label="Nguồn trích dẫn">
            <div className="citation-list__heading">
              <BookOpenText aria-hidden="true" size={18} />
              <h3>{response.citations?.length ?? 0} nguồn được đối chiếu</h3>
            </div>
            {(response.citations ?? []).map((citation, index) => (
              <article className="citation-item" key={citation.id ?? `${response.id}-${index}`}>
                <p>
                  <strong>
                    [{index + 1}] {citation.material?.title ?? citation.materialId}
                  </strong>
                  {citation.version?.year ? ` · Bản ${citation.version.year}` : ''}
                  {citation.pageNumber ? ` · Trang ${citation.pageNumber}` : ''}
                </p>
                <blockquote>{citation.quote}</blockquote>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
