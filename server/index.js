import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequestHandler } from './app.js'
import { createRuntimeConfig } from './runtimeConfig.js'
import { createRagClient } from './rag/client.js'
import { createRuntimeDatabase } from './db/runtime.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const runtimeConfig = createRuntimeConfig()
const port = runtimeConfig.port
const ragClient = runtimeConfig.rag.enabled ? createRagClient(runtimeConfig.rag) : undefined
const staticRoot = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const indexPath = resolve(staticRoot, 'index.html')
const db = createRuntimeDatabase(runtimeConfig)
const apiHandler = createRequestHandler({
  db,
  secureCookies: runtimeConfig.nodeEnv === 'production',
  ragClient,
  allowDemoRag: runtimeConfig.rag.demoData,
  authConfig: runtimeConfig.auth,
})

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function serveStatic(request, response) {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }

  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requestedPath = resolve(staticRoot, `.${pathname}`)
  const relativePath = relative(staticRoot, requestedPath)
  const isInsideStaticRoot = !relativePath.startsWith('..') && !isAbsolute(relativePath)
  const safePath = isInsideStaticRoot && existsSync(requestedPath) ? requestedPath : indexPath
  const finalPath = existsSync(safePath) && statSync(safePath).isFile() ? safePath : indexPath

  if (!existsSync(finalPath)) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Frontend chưa được build. Chạy npm run dev hoặc npm run build trước.')
    return
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(finalPath)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(finalPath).pipe(response)
}

const server = createServer((request, response) => {
  if (request.url?.startsWith('/api/')) {
    apiHandler(request, response)
    return
  }
  serveStatic(request, response)
})

server.listen(port, runtimeConfig.host, () => {
  console.log(`PTIT Teaching Assistant server: http://${runtimeConfig.host}:${port}`)
  console.log(`Database driver: ${runtimeConfig.database.driver}`)
})

function shutdown() {
  server.close(async () => {
    await db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
