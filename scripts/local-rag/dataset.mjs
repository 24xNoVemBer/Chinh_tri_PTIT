import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

const idPattern = /^[A-Za-z0-9._:-]{1,160}$/
const shaPattern = /^[a-f0-9]{64}$/

export function resolveDatasetConfig(root, env = process.env) {
  const dataset = env.RAG_DATASET || 'sample'
  if (!['sample', 'private'].includes(dataset)) {
    throw new Error('RAG_DATASET must be sample or private.')
  }
  if (dataset === 'sample') {
    const fixturePath = join(root, 'public', 'local-rag-sample.json')
    const descriptor = JSON.parse(readFileSync(fixturePath, 'utf8'))
    if (descriptor.sampleData !== true || !Array.isArray(descriptor.chunks)) {
      throw new Error('The local RAG sample fixture is invalid.')
    }
    return {
      dataset,
      descriptor,
      sourcePath: fixturePath,
      databasePath: join(root, 'data', 'local-rag', 'pilot.sqlite'),
      year: 2026,
      fileUrl: '/local-rag-sample.json',
      approvalId: 'approved-local-rag-sample',
      classMaterialId: 'cm-local-rag-sample',
    }
  }

  if (!env.RAG_CORPUS_MANIFEST) {
    throw new Error('RAG_CORPUS_MANIFEST is required when RAG_DATASET=private.')
  }
  const manifestPath = resolve(env.RAG_CORPUS_MANIFEST)
  if (!isAbsolute(manifestPath) || !existsSync(manifestPath)) {
    throw new Error('RAG_CORPUS_MANIFEST must point to an existing manifest file.')
  }
  const descriptor = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (
    descriptor.schemaVersion !== 'private-corpus-1' ||
    descriptor.sampleData !== false ||
    descriptor.status !== 'ready' ||
    !Number.isInteger(descriptor.chunkCount) ||
    descriptor.chunkCount < 1 ||
    !shaPattern.test(descriptor.source?.sha256 || '') ||
    !shaPattern.test(descriptor.chunksSha256 || '')
  ) {
    throw new Error('The private corpus manifest is invalid or not ready.')
  }
  for (const key of ['datasetId', 'tenantId', 'subjectId', 'materialId', 'materialVersionId']) {
    if (!idPattern.test(descriptor[key] || '')) throw new Error(`Invalid private corpus ${key}.`)
  }
  return {
    dataset,
    descriptor,
    sourcePath: manifestPath,
    databasePath: join(root, 'data', 'local-rag', 'private-pilot.sqlite'),
    year: 2021,
    fileUrl: `private-corpus://${descriptor.source.fileName}`,
    approvalId: `approved-${descriptor.materialId}`,
    classMaterialId: `cm-${descriptor.materialId}`,
  }
}
