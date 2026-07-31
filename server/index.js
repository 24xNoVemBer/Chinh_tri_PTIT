import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { createRequestHandler } from './app.js'
import { createDatabase, DEFAULT_DATABASE_PATH } from './database.js'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const envPath = resolve(projectRoot, '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'
const isProduction = process.env.NODE_ENV === 'production'
const databasePath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH

// Fail at startup rather than at request time. Behind a reverse proxy the Host header is
// the upstream address, not the domain the browser used, so the same-origin fallback would
// reject every state-changing request — a total outage with a very obscure cause.
if (isProduction && !String(process.env.TRUSTED_ORIGINS ?? '').trim()) {
  console.error(
    'Thiếu TRUSTED_ORIGINS. Ở chế độ production, hãy khai báo danh sách origin được tin cậy, ví dụ:\n' +
      '  TRUSTED_ORIGINS=https://chinhtri.ptit.edu.vn\n' +
      'Nhiều origin thì phân tách bằng dấu phẩy. Đây là danh sách dùng để chặn CSRF.',
  )
  process.exit(1)
}
const staticRoot = resolve(projectRoot, 'dist')
const indexPath = resolve(staticRoot, 'index.html')
const db = createDatabase({ databasePath })
const apiHandler = createRequestHandler({ db, secureCookies: isProduction })

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
}

const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json|xml|javascript))/

// Inline style attributes (progress bars, reveal-order custom properties) require
// 'unsafe-inline' in style-src; the Google Fonts import needs the two font hosts.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ')

function documentHeaders() {
  const headers = {
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  }
  if (isProduction) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  return headers
}

function sendPlain(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    ...documentHeaders(),
  })
  response.end(message)
}

function resolveStaticPath(request) {
  // A malformed escape sequence (e.g. GET /%) makes decodeURIComponent throw; an
  // unhandled throw here used to take down the whole process.
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    return { error: 400 }
  }

  const requestedPath = resolve(staticRoot, `.${pathname}`)
  const relativePath = relative(staticRoot, requestedPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return { error: 403 }

  let isFile
  try {
    isFile = existsSync(requestedPath) && statSync(requestedPath).isFile()
  } catch {
    isFile = false
  }
  if (isFile) return { filePath: requestedPath, isDocument: extname(requestedPath) === '.html' }

  // A request for a concrete asset that is missing must 404 rather than fall back to
  // index.html — otherwise a stale lazy chunk resolves to HTML with status 200 and the
  // module parse failure blanks the app.
  if (extname(pathname)) return { error: 404 }

  return { filePath: indexPath, isDocument: true }
}

function serveStatic(request, response) {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }

  const { filePath, isDocument, error } = resolveStaticPath(request)
  if (error === 400) return sendPlain(response, 400, 'Đường dẫn không hợp lệ.')
  if (error === 403) return sendPlain(response, 403, 'Không được phép truy cập đường dẫn này.')
  if (error === 404) return sendPlain(response, 404, 'Không tìm thấy tài nguyên.')

  if (!existsSync(filePath)) {
    return sendPlain(
      response,
      503,
      'Frontend chưa được build. Chạy npm run dev hoặc npm run build trước.',
    )
  }

  let stats
  try {
    stats = statSync(filePath)
  } catch {
    return sendPlain(response, 500, 'Không đọc được tài nguyên.')
  }

  const contentType = mimeTypes[extname(filePath)] ?? 'application/octet-stream'
  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    // Vite fingerprints everything under /assets/, so those are safe to cache forever.
    // The HTML shell must always be revalidated or clients pin to stale chunk names.
    'Cache-Control': isDocument
      ? 'no-cache'
      : filePath.includes(`${resolve(staticRoot, 'assets')}`)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
  }
  if (isDocument) Object.assign(headers, documentHeaders())

  const acceptsGzip = /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')
  const shouldCompress = acceptsGzip && COMPRESSIBLE.test(contentType) && stats.size > 1024

  if (shouldCompress) {
    headers['Content-Encoding'] = 'gzip'
    headers.Vary = 'Accept-Encoding'
  } else {
    headers['Content-Length'] = stats.size
  }

  response.writeHead(200, headers)
  if (request.method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => response.destroy())

  if (!shouldCompress) {
    stream.pipe(response)
    return
  }

  const gzip = createGzip()
  gzip.on('error', () => response.destroy())
  stream.pipe(gzip).pipe(response)
}

const server = createServer((request, response) => {
  try {
    if (request.url?.startsWith('/api/')) {
      apiHandler(request, response)
      return
    }
    serveStatic(request, response)
  } catch (error) {
    console.error('Unhandled request error:', error)
    if (!response.headersSent) sendPlain(response, 500, 'Hệ thống gặp lỗi ngoài dự kiến.')
    else response.destroy()
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Cổng ${port} đang được dùng bởi tiến trình khác.`)
  } else {
    console.error('Lỗi server:', error)
  }
  process.exit(1)
})

server.listen(port, host, () => {
  console.log(`PTIT Teaching Assistant server: http://${host}:${port}`)
  console.log(`SQLite database: ${databasePath}`)
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  // close() waits for in-flight requests; keep-alive sockets would otherwise hold the
  // process open indefinitely, so force the exit after a grace period.
  const forced = setTimeout(() => {
    console.error('Shutdown quá thời gian chờ, buộc thoát.')
    process.exit(1)
  }, 10_000)
  forced.unref()

  server.closeIdleConnections?.()
  server.close(() => {
    clearTimeout(forced)
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// A crash in one request must not take the whole site down with it.
process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
})
