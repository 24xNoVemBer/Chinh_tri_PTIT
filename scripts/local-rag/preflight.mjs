import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDatasetConfig } from './dataset.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const mbaPath = resolve(process.env.MBA_API_PATH || join(root, '..', 'ChatBot', 'MBA_API'))
const defaultPython =
  process.platform === 'win32'
    ? join(mbaPath, '.venv', 'Scripts', 'python.exe')
    : join(mbaPath, '.venv', 'bin', 'python')
const python = process.env.MBA_PYTHON || defaultPython
const mode = process.env.RAG_LOCAL_MODE || 'extractive'
const retrievalProfile = process.env.RAG_RETRIEVAL_PROFILE || 'legacy-v1'
const expectedDataRoot = resolve(root, 'data', 'local-rag')
const checks = []
function record(name, ok, detail) {
  checks.push({ name, ok, detail })
}

let datasetConfig
try {
  datasetConfig = resolveDatasetConfig(root)
  record('dataset-config', true, datasetConfig.dataset)
  const queryGate =
    process.env.RAG_QUERY_GATE || (datasetConfig.dataset === 'private' ? 'domain-v1' : 'none')
  record('query-gate', ['none', 'domain-v1'].includes(queryGate), queryGate)
} catch (error) {
  record('dataset-config', false, error.message)
}

const nodeMajor = Number(process.versions.node.split('.')[0])
record('node', nodeMajor >= 24, process.versions.node)
record('rag-mode', ['extractive', 'openai'].includes(mode), mode)
record(
  'retrieval-profile',
  ['legacy-v1', 'top5-v2', 'expanded-v3', 'definition-v4'].includes(retrievalProfile),
  retrievalProfile,
)
record('mba-api-checkout', existsSync(join(mbaPath, 'course_rag.py')), mbaPath)
record('python-runtime', existsSync(python), python)
if (mode === 'openai') {
  const provider = process.env.MODEL_PROVIDER || 'openai'
  record('model-provider', ['openai', 'groq'].includes(provider), provider)
  record(
    'model-api-key',
    Boolean(process.env.MODEL_API_KEY?.trim()),
    'configured=' + Boolean(process.env.MODEL_API_KEY?.trim()),
  )
  try {
    const defaultBaseUrl =
      provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
    const providerUrl = new URL(process.env.MODEL_API_BASE_URL || defaultBaseUrl)
    const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
    const safeTransport =
      ['http:', 'https:'].includes(providerUrl.protocol) &&
      !providerUrl.username &&
      !providerUrl.password &&
      !providerUrl.search &&
      !providerUrl.hash &&
      (providerUrl.protocol === 'https:' || loopbackHosts.has(providerUrl.hostname))
    const safeProvider =
      provider !== 'groq' ||
      providerUrl.href.replace(/\/$/, '') === 'https://api.groq.com/openai/v1'
    record(
      'model-api-base-url',
      safeTransport && safeProvider,
      `${providerUrl.protocol}//${providerUrl.host}`,
    )
  } catch {
    record('model-api-base-url', false, 'invalid URL')
  }
  const embeddingModel =
    process.env.EMBEDDING_MODEL_ID || (provider === 'groq' ? 'none' : 'text-embedding-3-large')
  record(
    'embedding-mode',
    provider !== 'groq' || embeddingModel.toLowerCase() === 'none',
    embeddingModel,
  )
}
if (datasetConfig) {
  const databasePath = resolve(datasetConfig.databasePath)
  record(
    'isolated-database-path',
    !isAbsolute(relative(expectedDataRoot, databasePath)) &&
      !relative(expectedDataRoot, databasePath).startsWith('..'),
    databasePath,
  )
  if (datasetConfig.dataset === 'sample') {
    const ids = new Set(datasetConfig.descriptor.chunks.map((chunk) => chunk.id))
    record(
      'sample-fixture',
      ids.size === datasetConfig.descriptor.chunks.length,
      `${ids.size} unique chunks`,
    )
  }
}

if (existsSync(python)) {
  const imports = spawnSync(
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
    imports.status === 0,
    imports.status === 0
      ? imports.stdout.trim()
      : imports.error?.code
        ? `process launch failed: ${imports.error.code}`
        : `import failed with exit code ${imports.status}`,
  )
  if (datasetConfig?.dataset === 'private') {
    const validation = spawnSync(
      python,
      [
        '-B',
        '-c',
        'from pathlib import Path; from corpus import load_private_corpus; import sys; m,c=load_private_corpus(Path(sys.argv[1])); print(len(c))',
        datasetConfig.sourcePath,
      ],
      {
        cwd: join(root, 'scripts', 'local-rag'),
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
    )
    record(
      'private-corpus-integrity',
      validation.status === 0,
      validation.status === 0 ? `${validation.stdout.trim()} verified chunks` : 'validation failed',
    )
  }
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
