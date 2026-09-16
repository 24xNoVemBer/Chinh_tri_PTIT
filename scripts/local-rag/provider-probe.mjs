import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--confirm-api-call')) {
  console.error(
    'Probe blocked: pass --confirm-api-call. Maximum: 1 embedding + 1 completion; retries disabled.',
  )
  process.exit(2)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const mbaPath = resolve(process.env.MBA_API_PATH || join(root, '..', 'ChatBot', 'MBA_API'))
const defaultPython =
  process.platform === 'win32'
    ? join(mbaPath, '.venv', 'Scripts', 'python.exe')
    : join(mbaPath, '.venv', 'bin', 'python')
const python = process.env.MBA_PYTHON || defaultPython
if (!existsSync(python)) throw new Error(`Python runtime not found: ${python}`)

const child = spawn(python, ['-B', 'scripts/local-rag/provider_probe.py', '--confirm-api-call'], {
  cwd: root,
  env: {
    ...process.env,
    MBA_API_PATH: mbaPath,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONIOENCODING: 'utf-8',
  },
  stdio: 'inherit',
  windowsHide: true,
})
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
