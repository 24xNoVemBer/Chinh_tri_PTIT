import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readlinkSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const statePath = join(root, 'data', 'local-rag', 'runtime.json')
if (!existsSync(statePath)) {
  console.log('Local RAG is not running (no runtime state).')
  process.exit(0)
}

let state
try {
  state = JSON.parse(readFileSync(statePath, 'utf8'))
} catch {
  throw new Error('Runtime state is malformed; refusing to stop any process.')
}

const rawProcesses =
  state.schemaVersion === 2
    ? state.processes
    : [state.launcherPid, ...(state.childPids ?? [])].map((pid) => ({ pid }))
if (!Array.isArray(rawProcesses) || !rawProcesses.length) {
  throw new Error('Runtime state contains no managed process list.')
}
const processes = rawProcesses.map((item) => ({ ...item, pid: Number(item.pid) }))
if (
  processes.some(
    (item) => !Number.isSafeInteger(item.pid) || item.pid <= 0 || item.pid === process.pid,
  )
) {
  throw new Error('Runtime state contains an unsafe PID; refusing to stop any process.')
}

function inspectWindowsProcesses(items) {
  const ids = items.map((item) => item.pid).join(',')
  const command =
    `$items = Get-Process -Id ${ids} -ErrorAction SilentlyContinue; ` +
    `$items | ForEach-Object { [pscustomobject]@{ pid=$_.Id; path=$_.Path; started=$_.StartTime.ToUniversalTime().ToString('o') } } | ConvertTo-Json -Compress`
  const inspection = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (inspection.error || inspection.status !== 0) {
    throw new Error('Could not verify managed process identity; no process was stopped.')
  }
  if (!inspection.stdout.trim()) return new Map()
  const parsed = JSON.parse(inspection.stdout)
  return new Map((Array.isArray(parsed) ? parsed : [parsed]).map((item) => [item.pid, item]))
}

function inspectLinuxProcesses(items) {
  const observed = new Map()
  for (const item of items) {
    const procPath = `/proc/${item.pid}`
    if (!existsSync(procPath)) continue

    let executable
    try {
      executable = readlinkSync(`${procPath}/exe`)
    } catch {
      throw new Error(
        `Could not verify executable for managed PID ${item.pid}; no process was stopped.`,
      )
    }

    const inspection = spawnSync('ps', ['-p', String(item.pid), '-o', 'lstart='], {
      encoding: 'utf8',
    })
    if (inspection.error || inspection.status !== 0 || !inspection.stdout.trim()) {
      throw new Error(
        `Could not verify start time for managed PID ${item.pid}; no process was stopped.`,
      )
    }
    observed.set(item.pid, {
      pid: item.pid,
      path: executable,
      started: new Date(inspection.stdout.trim()).toISOString(),
    })
  }
  return observed
}

function inspectProcesses(items) {
  if (process.platform === 'win32') return inspectWindowsProcesses(items)
  if (process.platform === 'linux') return inspectLinuxProcesses(items)
  throw new Error(`Unsupported platform ${process.platform}; no process was stopped.`)
}

function canonicalPath(path) {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

const initialObserved = inspectProcesses(processes)
const alive = processes.filter((item) => initialObserved.has(item.pid))
if (!alive.length) {
  rmSync(statePath, { force: true })
  console.log('Removed stale local RAG runtime state; no managed process was running.')
  process.exit(0)
}
if (state.schemaVersion !== 2 || !state.startedAt) {
  throw new Error('Legacy runtime state references a live PID; refusing unsafe termination.')
}

const startedAt = Date.parse(state.startedAt)
if (!Number.isFinite(startedAt)) throw new Error('Runtime state has an invalid start time.')
for (const item of alive) {
  if (!['launcher', 'rag', 'web'].includes(item.role) || !item.executable) {
    throw new Error('Runtime state lacks process identity; refusing unsafe termination.')
  }
}

// Validate executable and creation time before acting, protecting against PID reuse.
for (const expected of alive) {
  const actual = initialObserved.get(expected.pid)
  const samePath =
    actual?.path &&
    canonicalPath(actual.path).toLowerCase() === canonicalPath(expected.executable).toLowerCase()
  const closeStart = actual?.started && Math.abs(Date.parse(actual.started) - startedAt) < 60_000
  if (!samePath || !closeStart) {
    throw new Error(
      `PID ${expected.pid} no longer matches its recorded process; nothing was stopped.`,
    )
  }
}

for (const role of ['web', 'rag', 'launcher']) {
  const item = alive.find((processInfo) => processInfo.role === role)
  if (item && inspectProcesses([item]).has(item.pid)) process.kill(item.pid, 'SIGTERM')
}
for (let attempt = 0; attempt < 20 && inspectProcesses(alive).size; attempt++) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 100))
}
const finalObserved = inspectProcesses(alive)
const remaining = alive.filter((item) => finalObserved.has(item.pid))
if (remaining.length) {
  throw new Error(
    `Stop requested, but managed PID(s) still exist: ${remaining.map((item) => item.pid).join(', ')}`,
  )
}
rmSync(statePath, { force: true })
console.log('Stopped the local RAG pilot and removed its runtime state.')
