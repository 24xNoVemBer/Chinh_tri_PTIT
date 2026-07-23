import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Bot,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  MessageCircleQuestion,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import ptitCivicClassImage from '../../assets/ptit-civic-class.jpg'
import ptitCivicContextImage from '../../assets/ptit-civic-context.jpg'
import ptitReadingDayImage from '../../assets/ptit-reading-day.jpg'
import ptitStudentsImage from '../../assets/ptit-students.jpg'
import { useAuth } from '../../features/auth/useAuth'
import './HomePage.css'

const BENTO_ITEMS = [
  {
    className: 'home-bento__student',
    icon: MessageCircleQuestion,
    title: 'Sinh viên hỏi trong đúng ngữ cảnh',
    description:
      'Chọn môn học, đặt câu hỏi và theo dõi nguồn tham khảo ngay trong cùng một cuộc hội thoại.',
  },
  {
    className: 'home-bento__lecturer',
    icon: LayoutDashboard,
    title: 'Giảng viên nhìn thấy điều lớp đang vướng',
    description:
      'Quản lý lớp, học liệu và hàng đợi câu hỏi theo từng học phần thay vì gom vào nhiều công cụ rời.',
  },
  {
    className: 'home-bento__source',
    icon: FileCheck2,
    title: 'Nguồn đứng cạnh câu trả lời',
    description:
      'Mỗi câu trả lời mẫu đều chừa sẵn không gian cho giáo trình, chương và trang được trích dẫn.',
  },
  {
    className: 'home-bento__review',
    icon: ShieldCheck,
    title: 'Model sẽ được nối sau',
    description:
      'Bản hiện tại tập trung vào UI/UX. Nội dung AI đang là dữ liệu mô phỏng và luôn được ghi rõ.',
  },
]

const WORKFLOW = [
  {
    icon: GraduationCap,
    title: 'Đăng nhập bằng tài khoản PTIT',
    description: 'Hệ thống đọc loại tài khoản và tự mở đúng không gian sinh viên hoặc giảng viên.',
  },
  {
    icon: Bot,
    title: 'Hỏi bài hoặc quản lý lớp',
    description:
      'Sinh viên trò chuyện theo học phần. Giảng viên theo dõi lớp, học liệu và câu hỏi.',
  },
  {
    icon: BookOpenCheck,
    title: 'Kiểm tra nguồn rồi tiếp tục học',
    description:
      'Câu trả lời luôn dành chỗ cho trích dẫn và trạng thái kiểm duyệt trước khi sử dụng.',
  },
]

// Ảnh được lưu cục bộ từ các kênh chính thức của PTIT.
// sourceUrl được giữ lại để đội dự án đối chiếu trong vòng kiểm duyệt nội dung.
const PTIT_MEDIA = [
  {
    alt: 'Sinh viên và giảng viên PTIT xem phần trưng bày sách tại Ngày hội đọc sách 2026',
    className: 'home-media-card--reading',
    height: 580,
    image: ptitReadingDayImage,
    label: 'Thư viện và học liệu',
    sourceUrl:
      'https://ptit.edu.vn/ngay-hoi-doc-sach-ptit-2026-tri-thuc-song-hanh-cung-cong-nghe-so/',
    title: 'Tri thức đi cùng bối cảnh',
    width: 868,
  },
  {
    alt: 'Chuyên đề Sinh viên thời đại số, Trách nhiệm và bản lĩnh tại PTIT',
    className: 'home-media-card--civic',
    height: 960,
    image: ptitCivicContextImage,
    label: 'Chính trị và công dân số',
    sourceUrl:
      'https://student.ptit.edu.vn/2025/09/11/tan-sinh-vien-ptit-hung-khoi-buoc-vao-tuan-sinh-hoat-cong-dan-sinh-vien-nam-hoc-2025-2026/',
    title: 'Học để hiểu trách nhiệm của mình',
    width: 1280,
  },
  {
    alt: 'Sinh viên PTIT cùng đặt tay ở giữa thể hiện tinh thần đồng đội',
    className: 'home-media-card--community',
    height: 333,
    image: ptitStudentsImage,
    label: 'Cộng đồng PTIT',
    sourceUrl: 'https://ptit.edu.vn/',
    title: 'Một không gian học tập có người đồng hành',
    width: 500,
  },
]

export default function HomePage() {
  const { isLoading, user } = useAuth()
  const workspacePath = user ? `/${user.role}` : '/login'
  const workspaceLabel = user ? 'Vào không gian của bạn' : 'Đăng nhập'
  const chatbotPath = user?.role === 'student' ? '/student/chat' : user ? '/lecturer' : '/login'
  const chatbotLabel = user?.role === 'lecturer' ? 'Vào không gian giảng viên' : 'Mở chatbot'

  return (
    <div className="home-page">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <header className="home-nav">
        <Link className="home-wordmark" to="/" aria-label="Trang chủ PTIT Chính Trị">
          <span className="home-wordmark__mark" aria-hidden="true">
            P
          </span>
          <span>PTIT Chính Trị</span>
        </Link>
        <nav className="home-nav__links" aria-label="Điều hướng trang giới thiệu">
          <a href="#kha-nang">Khám phá</a>
          <Link to={workspacePath}>{isLoading ? 'Đang kiểm tra' : workspaceLabel}</Link>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <p className="home-kicker">Trợ giảng số cho PTIT</p>
            <h1 id="home-title">Học chính trị, có người dẫn đường.</h1>
            <p className="home-hero__lede">
              Tra cứu học liệu, hỏi theo ngữ cảnh và trở lại lớp học với câu trả lời có nguồn.
            </p>
            <div className="home-hero__actions">
              <Link className="home-button home-button--primary" to={workspacePath}>
                {workspaceLabel}
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <a className="home-button home-button--quiet" href="#cach-hoat-dong">
                Xem cách hoạt động
              </a>
            </div>
          </div>

          <figure className="home-hero__figure">
            <div className="home-hero__image-wrap">
              <img
                src={ptitCivicClassImage}
                width="1211"
                height="788"
                fetchPriority="high"
                alt="Sinh viên PTIT tham dự Tuần Sinh hoạt Công dân, Sinh viên trong hội trường"
              />
            </div>
            <figcaption>
              Tuần Sinh hoạt Công dân, Sinh viên PTIT 2025.{' '}
              <a
                href="https://student.ptit.edu.vn/2025/09/11/tan-sinh-vien-ptit-hung-khoi-buoc-vao-tuan-sinh-hoat-cong-dan-sinh-vien-nam-hoc-2025-2026/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Nguồn PTIT
              </a>
            </figcaption>
          </figure>
        </section>

        <section className="home-intro" aria-labelledby="home-intro-title">
          <h2 id="home-intro-title">Một cổng chung. Hai luồng làm việc rõ ràng.</h2>
          <p>
            Tài khoản quyết định nơi bạn đến. Sinh viên tập trung vào học và hỏi. Giảng viên tập
            trung vào lớp, học liệu và những câu hỏi cần xử lý.
          </p>
        </section>

        <section className="home-media-section" aria-labelledby="home-media-title">
          <div className="home-section-heading home-section-heading--media">
            <h2 id="home-media-title">Học trong bối cảnh thật</h2>
            <p>
              Lớp học, thư viện và hoạt động công dân tạo nên phần bối cảnh mà một câu trả lời tốt
              cần tôn trọng.
            </p>
          </div>
          <div className="home-media-grid">
            {PTIT_MEDIA.map((item) => (
              <a
                className={`home-media-card ${item.className}`}
                href={item.sourceUrl}
                key={item.title}
                target="_blank"
                rel="noopener noreferrer"
              >
                <figure>
                  <div className="home-media-card__image-wrap">
                    <img
                      src={item.image}
                      width={item.width}
                      height={item.height}
                      loading="lazy"
                      decoding="async"
                      alt={item.alt}
                    />
                  </div>
                  <figcaption>
                    <span className="home-media-card__label">{item.label}</span>
                    <strong>{item.title}</strong>
                    <span className="home-media-card__source">
                      Ảnh: PTIT
                      <ArrowUpRight aria-hidden="true" size={16} />
                    </span>
                  </figcaption>
                </figure>
              </a>
            ))}
          </div>
        </section>

        <section className="home-bento-section" id="kha-nang" aria-labelledby="home-bento-title">
          <div className="home-section-heading">
            <h2 id="home-bento-title">Đủ gần với lớp học thật</h2>
            <p>
              Không thay thế giảng viên. Giao diện giúp việc học và phản hồi diễn ra liền mạch hơn.
            </p>
          </div>
          <div className="home-bento">
            {BENTO_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <article className={`home-bento__item ${item.className}`} key={item.title}>
                  <Icon aria-hidden="true" size={24} />
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="home-workflow" id="cach-hoat-dong" aria-labelledby="workflow-title">
          <div className="home-workflow__heading">
            <h2 id="workflow-title">Từ đăng nhập đến đúng việc cần làm</h2>
            <p>
              Không cần chọn vai trò thủ công. Quyền truy cập đi theo chính tài khoản đã đăng nhập.
            </p>
          </div>
          <ol className="home-workflow__list">
            {WORKFLOW.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title}>
                  <Icon aria-hidden="true" size={22} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="home-chat-cta" aria-labelledby="chat-cta-title">
          <div>
            <Bot aria-hidden="true" size={28} />
            <h2 id="chat-cta-title">Chatbot đang ở chế độ demo UI</h2>
            <p>
              Bạn có thể thử hội thoại, trạng thái trả lời và trích dẫn mẫu. Model RAG sẽ được tích
              hợp sau.
            </p>
          </div>
          <Link className="home-button home-button--primary" to={chatbotPath}>
            {chatbotLabel}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <p className="home-wordmark">PTIT Chính Trị</p>
          <p className="home-footer__tagline">
            Hỗ trợ giảng viên quản lý lớp và sinh viên tra cứu, hỏi đáp.
          </p>
        </div>
        <div className="home-footer__links">
          <Link to="/login">Đăng nhập</Link>
          <a href="#main-content">Về đầu trang</a>
        </div>
        <p className="home-footer__credit">
          Giao diện demo phục vụ review UI/UX. Nội dung AI chưa phải kết quả từ model.
        </p>
      </footer>
    </div>
  )
}
