import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const mbaPath = resolve(process.env.MBA_API_PATH || join(root, '..', 'ChatBot', 'MBA_API'))
const defaultPython =
  process.platform === 'win32'
    ? join(mbaPath, '.venv', 'Scripts', 'python.exe')
    : join(mbaPath, '.venv', 'bin', 'python')
const python = process.env.MBA_PYTHON || defaultPython
const fixturePath = join(root, 'public', 'local-rag-sample.json')
const databasePath = resolve(root, 'data', 'local-rag', 'pilot.sqlite')
const expectedDataRoot = resolve(root, 'data', 'local-rag')

const checks = []
function record(name, ok, detail) {
  checks.push({ name, ok, detail })
}

const nodeMajor = Number(process.versions.node.split('.')[0])
record('node', nodeMajor >= 24, process.versions.node)
record('mba-api-checkout', existsSync(join(mbaPath, 'course_rag.py')), mbaPath)
record('python-runtime', existsSync(python), python)
record(
  'isolated-database-path',
  !isAbsolute(relative(expectedDataRoot, databasePath)) &&
    !relative(expectedDataRoot, databasePath).startsWith('..'),
  databasePath,
)

try {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
  const ids = new Set(fixture.chunks?.map((chunk) => chunk.id))
  record(
    'sample-fixture',
    fixture.sampleData === true &&
      fixture.subjectId === 'sub1' &&
      ids.size === fixture.chunks.length,
    `${fixture.chunks?.length ?? 0} unique chunks`,
  )
} catch (error) {
  record('sample-fixture', false, error.message)
}

if (existsSync(python)) {
  const probe = spawnSync(
    python,
    [
      '-B',
      '-c',
      'import fastapi, uvicorn, pydantic, openai, course_rag, sys; print(sys.version.split()[0])',
    ],
    {
      cwd: mbaPath,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    },
  )
  record(
    'python-imports',
    probe.status === 0,
    probe.status === 0
      ? probe.stdout.trim()
      : probe.error?.code
        ? `process launch failed: ${probe.error.code}`
        : `import failed with exit code ${probe.status}`,
  )
}

for (const port of [3101, 8787]) {
  const available = await new Promise((resolvePort) => {
    const server = createServer()
    server.once('error', () => resolvePort(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)))
  })
  record(`port-${port}`, available, available ? 'available' : 'busy')
}

const failed = checks.filter((check) => !check.ok)
console.log(JSON.stringify({ result: failed.length ? 'FAIL' : 'PASS', checks }, null, 2))
if (failed.length) process.exitCode = 1
