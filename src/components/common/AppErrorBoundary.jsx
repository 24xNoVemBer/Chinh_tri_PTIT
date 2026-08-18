import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught interface error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="error-boundary" role="alert">
        <p className="section-heading__eyebrow">Lỗi giao diện</p>
        <h1>Không thể hiển thị trang này</h1>
        <p>{this.state.error.message || 'Hệ thống gặp lỗi ngoài dự kiến.'}</p>
        <div className="button-group">
          <button
            className="button button--primary"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            Thử lại
          </button>
          <a className="button button--secondary" href="/">
            Về trang chủ
          </a>
        </div>
      </main>
    )
  }
}
