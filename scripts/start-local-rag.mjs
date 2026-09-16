import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createDatabase } from '../server/database.js'
import { resolveDatasetConfig } from './local-rag/dataset.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mbaPath = resolve(process.env.MBA_API_PATH || join(root, '..', 'ChatBot', 'MBA_API'))
const defaultPython =
  process.platform === 'win32'
    ? join(mbaPath, '.venv', 'Scripts', 'python.exe')
    : join(mbaPath, '.venv', 'bin', 'python')
const python = process.env.MBA_PYTHON || defaultPython
const mode = process.env.RAG_LOCAL_MODE || 'extractive'
const datasetConfig = resolveDatasetConfig(root)
const { dataset, descriptor: fixture, databasePath } = datasetConfig
const runtimeStatePath = join(root, 'data', 'local-rag', 'runtime.json')
const launchedAt = new Date().toISOString()
if (!['extractive', 'openai'].includes(mode)) throw new Error('RAG_LOCAL_MODE: extractive | openai')
if (!existsSync(python) || !existsSync(join(mbaPath, 'course_rag.py'))) {
  throw new Error(
    'Set MBA_API_PATH and MBA_PYTHON to the existing MBA_API checkout and Python environment.',
  )
}

// Fixed isolated ports/database: never pick up the normal app DB from .env.
for (const port of [3101, 8787]) {
  await new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', () =>
      reject(new Error(`Port ${port} is busy; no existing process was stopped.`)),
    )
    probe.listen(port, '127.0.0.1', () => probe.close(resolvePort))
  })
}

const db = createDatabase({ databasePath })
const now = new Date().toISOString()
try {
  // Only the dedicated pilot DB is seeded. Existing app data is not copied or updated.
  db.prepare(
    `INSERT OR IGNORE INTO materials
    (id, subject_id, title, type, author, created_by, created_at)
    VALUES (?, ?, ?, 'reference', ?, 'l1', ?)`,
  ).run(fixture.materialId, fixture.subjectId, fixture.title, fixture.author, now)
  db.prepare(
    `INSERT OR IGNORE INTO material_versions
    (id, material_id, year, file_url, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, 'l1', ?)`,
  ).run(
    fixture.materialVersionId,
    fixture.materialId,
    datasetConfig.year,
    datasetConfig.fileUrl,
    now,
  )
  db.prepare(
    `INSERT OR IGNORE INTO approved_sources
    (id, material_id, is_approved, approved_by, approved_at)
    VALUES (?, ?, 1, 'l1', ?)`,
  ).run(datasetConfig.approvalId, fixture.materialId, now)
  db.prepare(
    `INSERT OR REPLACE INTO class_materials
    (id, class_id, material_id, version_id, status, added_by, added_at)
    VALUES (?, 'class1', ?, ?, 'published', 'l1', ?)`,
  ).run(datasetConfig.classMaterialId, fixture.materialId, fixture.materialVersionId, now)
} finally {
  db.close()
}

const token = randomBytes(32).toString('hex')
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: '3101',
  DATABASE_DRIVER: 'sqlite',
  DATABASE_PATH: databasePath,
  RAG_ENABLED: 'true',
  RAG_DEMO_DATA: 'false',
  RAG_BASE_URL: 'http://127.0.0.1:8787',
  RAG_SERVICE_TOKEN: token,
  RAG_TIMEOUT_MS: '35000',
  RAG_MAX_RETRIES: '0',
  MBA_API_PATH: mbaPath,
  RAG_LOCAL_MODE: mode,
  RAG_DATASET: dataset,
  ...(dataset === 'private' ? { RAG_CORPUS_MANIFEST: datasetConfig.sourcePath } : {}),
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONIOENCODING: 'utf-8',
}
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill()
  rmSync(runtimeStatePath, { force: true })
  process.exitCode = code
}
function start(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', (error) => {
    console.error(error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code || 1)
  })
  return child
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
process.on('exit', () => rmSync(runtimeStatePath, { force: true }))

try {
  start(python, ['-B', 'scripts/local-rag/adapter.py'])
  let ready = false
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try {
      const response = await fetch(`${env.RAG_BASE_URL}/internal/v1/readiness`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1000),
      })
      ready = response.ok
    } catch {
      /* adapter may still be importing MBA dependencies */
    }
    if (ready) break
    await delay(500)
  }
  if (!ready) throw new Error('Local RAG adapter did not become ready. See the error above.')
  if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('Run npm run build first.')
  start(process.execPath, ['--no-warnings', 'server/index.js'])
  writeFileSync(
    runtimeStatePath,
    JSON.stringify(
      {
        schemaVersion: 2,
        launcherPid: process.pid,
        processes: [
          { pid: process.pid, role: 'launcher', executable: process.execPath },
          { pid: children[0].pid, role: 'rag', executable: python },
          { pid: children[1].pid, role: 'web', executable: process.execPath },
        ],
        ports: { web: 3101, rag: 8787 },
        mode,
        dataset,
        databasePath,
        startedAt: launchedAt,
      },
      null,
      2,
    ),
  )
  const dataLabel = dataset === 'sample' ? 'SAMPLE DATA ONLY' : 'PRIVATE CORPUS · UNREVIEWED'
  console.log(`\nLocal pilot: http://127.0.0.1:3101/student/chat\nMode: ${mode}; ${dataLabel}`)
  console.log('Login: tuananh@ptit.edu.vn / Student@123; select Triết học Mác - Lênin (sub1).')
  console.log('Ctrl+C stops both child services. Your normal database is untouched.')
} catch (error) {
  console.error(error.message)
  stop(1)
}
