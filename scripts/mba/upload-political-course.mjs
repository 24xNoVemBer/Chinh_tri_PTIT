import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { audit } from './audit-political-corpus.mjs'

const timeoutMs = 5 * 60 * 1000

function parseArgs(args) {
  const options = {
    baseUrl: 'http://127.0.0.1:4558',
    confirmSourceEmpty: false,
    confirmUpload: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--confirm-upload') options.confirmUpload = true
    else if (arg === '--confirm-source-empty') options.confirmSourceEmpty = true
    else if (['--root', '--source', '--base-url'].includes(arg)) {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`)
      options[{ '--root': 'root', '--source': 'source', '--base-url': 'baseUrl' }[arg]] = value
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

function printUsage() {
  console.log(`Usage:
  npm run mba:corpus:upload -- --root <backup-folder> --source <BAS-code> [--base-url <url>]

Default behavior is a local dry-run. A real upload requires both:
  --confirm-source-empty --confirm-upload

Only one course/source can be uploaded per invocation.`)
}

function validateBaseUrl(value) {
  const url = new URL(value)
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password
  ) {
    throw new Error('MBA_API URL must use HTTPS or HTTP loopback, without embedded credentials.')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('MBA_API base URL must be an origin without a path, query, or fragment.')
  }
  return url.origin
}

async function request(url, options, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    const detail = controller.signal.aborted ? 'request timed out' : error.message
    throw new Error(`${detail}; inspect MBA_API files and logs before any retry.`, { cause: error })
  } finally {
    clearTimeout(timer)
  }
}

async function uploadCourse({ baseUrl, course, root }) {
  const form = new FormData()
  form.set('file_id', course.targetSourceId)
  for (const document of course.uploadDocuments) {
    const path = resolve(root, document.path)
    const bytes = await readFile(path)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== document.sha256) {
      throw new Error(`File changed after audit; refusing to upload ${document.path}.`)
    }
    form.append('files', new Blob([bytes], { type: 'application/pdf' }), basename(path))
  }

  let response
  try {
    response = await request(`${baseUrl}/upload`, { method: 'POST', body: form }, timeoutMs)
  } catch (error) {
    throw new Error(
      `Upload outcome may be partial for ${course.targetSourceId}: ${error.message}`,
      {
        cause: error,
      },
    )
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.status !== 'uploaded') {
    throw new Error(
      `MBA_API upload returned HTTP ${response.status}; inspect source files, collection, and logs before retrying.`,
    )
  }
  return body
}

let options
try {
  options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    process.exit(0)
  }
  if (!options.root || !options.source) throw new Error('Both --root and --source are required.')
  options.source = options.source.toUpperCase()
  const baseUrl = validateBaseUrl(options.baseUrl)
  if (options.confirmUpload !== options.confirmSourceEmpty) {
    throw new Error('A real upload requires both --confirm-source-empty and --confirm-upload.')
  }

  const report = await audit(resolve(options.root))
  if (!report.readyForUpload)
    throw new Error('Corpus audit failed; fix the listed issues before upload.')
  const course = report.courses.find((item) => item.targetSourceId === options.source)
  if (!course)
    throw new Error(
      `Unsupported source ${options.source}; choose one of the five BAS course codes.`,
    )
  if (!course.uploadDocuments.length) throw new Error(`No valid PDFs found for ${options.source}.`)

  const bytes = course.uploadDocuments.reduce((sum, item) => sum + item.bytes, 0)
  console.log(
    JSON.stringify(
      {
        mode: options.confirmUpload ? 'upload' : 'dry-run',
        api: baseUrl,
        source: course.targetSourceId,
        course: course.name,
        documents: course.uploadDocuments.map(({ path, role, bytes: size, sha256 }) => ({
          path,
          role,
          bytes: size,
          sha256,
        })),
        totalBytes: bytes,
      },
      null,
      2,
    ),
  )

  if (!options.confirmUpload) {
    console.log(
      'DRY RUN: no network request was made. Review the list before authorizing an upload.',
    )
  } else {
    const healthResponse = await request(`${baseUrl}/health`, {}, 5_000)
    const health = await healthResponse.json().catch(() => null)
    if (!healthResponse.ok || health?.api_status !== 'healthy') {
      throw new Error('MBA_API health check failed; no upload was sent.')
    }
    const result = await uploadCourse({ baseUrl, course, root: resolve(options.root) })
    console.log(
      JSON.stringify(
        { result, note: 'Upload API returns before background indexing finishes.' },
        null,
        2,
      ),
    )
  }
} catch (error) {
  console.error(`MBA course upload stopped: ${error.message}`)
  if (error.status) process.exitCode = error.status
  else process.exitCode = 1
}
