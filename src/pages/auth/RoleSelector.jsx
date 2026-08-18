import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import ptitStudentsImage from '../../assets/ptit-students.jpg'
import { useAuth } from '../../features/auth/useAuth'
import './RoleSelector.css'

const DEMO_ACCOUNTS = [
  {
    label: 'Tài khoản sinh viên',
    description: 'Nguyễn Văn Tuấn Anh',
    email: 'tuananh@ptit.edu.vn',
    password: 'Student@123',
    icon: BookOpenCheck,
  },
  {
    label: 'Tài khoản giảng viên',
    description: 'TS. Đào Đức Tú',
    email: 'ductu@ptit.edu.vn',
    password: 'Lecturer@123',
    icon: GraduationCap,
  },
]

function validate(values) {
  const nextErrors = {}
  if (!values.email.trim()) nextErrors.email = 'Vui lòng nhập email PTIT.'
  else if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = 'Email chưa đúng định dạng.'
  if (!values.password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
  return nextErrors
}

function getDestination(user, requestedPath) {
  return requestedPath?.startsWith(`/${user.role}`) ? requestedPath : `/${user.role}`
}

export default function RoleSelector() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading, login, user } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const selectedDemoAccount = DEMO_ACCOUNTS.find(
    (account) => account.email === values.email && account.password === values.password,
  )

  if (!isLoading && user) {
    return <Navigate to={getDestination(user, location.state?.from)} replace />
  }

  const updateField = (event) => {
    const { name, value } = event.target
    const nextValues = { ...values, [name]: value }
    setValues(nextValues)
    setServerError('')
    if (touched[name]) setErrors(validate(nextValues))
  }

  const handleBlur = (event) => {
    const nextTouched = { ...touched, [event.target.name]: true }
    setTouched(nextTouched)
    setErrors(validate(values))
  }

  const fillDemoAccount = (account) => {
    setValues({ email: account.email, password: account.password })
    setErrors({})
    setTouched({})
    setServerError('')
    emailRef.current?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setTouched({ email: true, password: true })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setServerError('')
    try {
      const authenticatedUser = await login(values)
      navigate(getDestination(authenticatedUser, location.state?.from), { replace: true })
    } catch (error) {
      setServerError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="role-selector-container">
      <a className="role-selector-skip-link" href="#login-form">
        Đi đến biểu mẫu đăng nhập
      </a>

      <section className="role-selector-shell" aria-labelledby="login-title">
        <header className="role-selector-topbar">
          <Link className="role-selector-brand" to="/">
            <span className="role-selector-brand__mark">PTIT</span>
            <span>Chính Trị</span>
          </Link>

          <Link className="login-panel__back" to="/">
            <ArrowLeft aria-hidden="true" size={18} />
            Về trang chủ
          </Link>
        </header>

        <div className="role-selector-layout">
          <section className="login-panel">
            <div className="login-panel__header">
              <p className="login-panel__kicker">Hệ thống học tập PTIT</p>
              <h1 id="login-title">Đăng nhập</h1>
              <p>Sử dụng tài khoản PTIT để truy cập không gian học tập phù hợp.</p>
            </div>

            <form
              id="login-form"
              className="login-form"
              aria-busy={isSubmitting || isLoading}
              noValidate
              onSubmit={handleSubmit}
            >
              <div className="form-field">
                <label htmlFor="login-email">Email PTIT</label>
                <input
                  id="login-email"
                  ref={emailRef}
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="tenban@ptit.edu.vn"
                  value={values.email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : 'login-email-hint'}
                  onBlur={handleBlur}
                  onChange={updateField}
                />
                {errors.email ? (
                  <span className="form-field__error" id="login-email-error" role="alert">
                    {errors.email}
                  </span>
                ) : (
                  <span className="form-field__hint" id="login-email-hint">
                    Tài khoản tự xác định quyền truy cập sau khi đăng nhập.
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="login-password">Mật khẩu</label>
                <div className="password-field">
                  <input
                    id="login-password"
                    ref={passwordRef}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={values.password}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? 'login-password-error' : 'login-password-hint'
                    }
                    onBlur={handleBlur}
                    onChange={updateField}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                {errors.password ? (
                  <span className="form-field__error" id="login-password-error" role="alert">
                    {errors.password}
                  </span>
                ) : (
                  <span className="form-field__hint" id="login-password-hint">
                    Dùng mật khẩu của tài khoản PTIT.
                  </span>
                )}
              </div>

              {serverError && (
                <div className="login-form__error" role="alert">
                  {serverError}
                </div>
              )}

              <button
                className="login-form__submit"
                type="submit"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting || isLoading ? (
                  <>
                    <LoaderCircle className="login-form__spinner" aria-hidden="true" size={19} />
                    Đang xác thực…
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight aria-hidden="true" size={19} />
                  </>
                )}
              </button>
            </form>

            <section className="demo-accounts" aria-labelledby="demo-accounts-title">
              <div className="demo-accounts__heading">
                <h2 id="demo-accounts-title">Thử nhanh bằng tài khoản demo</h2>
                <p>Chọn một tài khoản để điền sẵn thông tin.</p>
              </div>
              <div className="demo-accounts__grid">
                {DEMO_ACCOUNTS.map((account) => {
                  const Icon = account.icon
                  const isSelected = selectedDemoAccount?.email === account.email

                  return (
                    <button
                      key={account.email}
                      className={isSelected ? 'is-selected' : undefined}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => fillDemoAccount(account)}
                    >
                      <span className="demo-account__icon">
                        <Icon aria-hidden="true" size={20} />
                      </span>
                      <span className="demo-account__copy">
                        <strong>{account.label}</strong>
                        <small>{account.description}</small>
                      </span>
                      {isSelected ? (
                        <CheckCircle2
                          className="demo-account__status"
                          aria-hidden="true"
                          size={19}
                        />
                      ) : (
                        <ArrowRight className="demo-account__status" aria-hidden="true" size={19} />
                      )}
                    </button>
                  )
                })}
              </div>
              <span className="sr-only" aria-live="polite">
                {selectedDemoAccount ? `Đã điền ${selectedDemoAccount.label}.` : ''}
              </span>
            </section>
          </section>

          <aside className="role-selector-intro" aria-labelledby="login-intro-title">
            <figure className="role-selector-visual">
              <img
                src={ptitStudentsImage}
                width="500"
                height="333"
                fetchPriority="high"
                alt="Nhóm sinh viên PTIT cùng kết nối trong hoạt động tập thể"
              />
            </figure>

            <div className="role-selector-intro__copy">
              <h2 id="login-intro-title">Học đúng môn. Hỏi đúng ngữ cảnh.</h2>
              <p>
                Tra cứu giáo trình, đặt câu hỏi với AI trợ giảng và tiếp tục ôn tập theo từng học
                phần.
              </p>
              <ul>
                <li>
                  <BookOpenCheck aria-hidden="true" size={19} />
                  Hỏi theo học phần đang học
                </li>
                <li>
                  <ShieldCheck aria-hidden="true" size={19} />
                  Đối chiếu giáo trình và nguồn chính thống
                </li>
                <li>
                  <GraduationCap aria-hidden="true" size={19} />
                  Tiếp tục lộ trình ôn tập
                </li>
              </ul>
            </div>

            <div className="role-selector-trust">
              <ShieldCheck aria-hidden="true" size={20} />
              <span>Quyền truy cập được nhận diện từ tài khoản PTIT.</span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
