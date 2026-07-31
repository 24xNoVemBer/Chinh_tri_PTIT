import { Component } from 'react'

/**
 * Last line of defence for render-time crashes.
 *
 * Without this, one thrown error unmounts the whole tree and leaves a blank page with no
 * way back. A stale lazy chunk after a deploy is the common trigger, so offer a reload
 * alongside the reset.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Lỗi giao diện không được xử lý:', error, info?.componentStack)
  }

  handleReset() {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A failed dynamic import means the deployed chunk names moved on; a reload is the
    // only thing that actually recovers it.
    const isChunkError = /dynamically imported module|Importing a module script failed/i.test(
      error.message ?? '',
    )

    return (
      <div className="error-boundary" role="alert">
        <h1>Giao diện gặp lỗi ngoài dự kiến</h1>
        <p>
          {isChunkError
            ? 'Có thể ứng dụng vừa được cập nhật. Hãy tải lại trang để lấy phiên bản mới nhất.'
            : 'Chúng tôi đã ghi nhận lỗi này. Bạn có thể thử lại hoặc tải lại trang.'}
        </p>
        <div className="error-boundary__actions">
          <button className="button button--primary" type="button" onClick={this.handleReset}>
            Thử lại
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </button>
        </div>
        {import.meta.env.DEV && <pre className="error-boundary__detail">{String(error.stack)}</pre>}
      </div>
    )
  }
}
