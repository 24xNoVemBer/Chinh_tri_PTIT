import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = process.cwd()
const schemaRoot = join(root, 'contracts', 'schemas')
const examplesRoot = join(root, 'contracts', 'examples')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else files.push(path)
  }
  return files
}

const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)
const schemas = await walk(schemaRoot)
for (const path of schemas.filter((file) => file.endsWith('.json'))) {
  const schema = JSON.parse(await readFile(path, 'utf8'))
  ajv.addSchema(schema)
}

const checks = [
  [
    'chat-request.json',
    'https://contracts.ptit-chinh-tri.local/schemas/chat/create-chat-request.schema.json',
  ],
  [
    'terminal-answer.json',
    'https://contracts.ptit-chinh-tri.local/schemas/chat/terminal-answer.schema.json',
  ],
  [
    'blocked-answer.json',
    'https://contracts.ptit-chinh-tri.local/schemas/chat/terminal-answer.schema.json',
  ],
  [
    'ingestion-manifest.json',
    'https://contracts.ptit-chinh-tri.local/schemas/ingestion/material-manifest.schema.json',
  ],
]

let failed = false
for (const [file, schemaId] of checks) {
  const payload = JSON.parse(await readFile(join(examplesRoot, file), 'utf8'))
  const validate = ajv.getSchema(schemaId)
  const valid = validate(payload)
  if (!valid) {
    failed = true
    console.error(`INVALID ${relative(root, join(examplesRoot, file))}`)
    console.error(validate.errors)
  } else {
    console.log(`OK ${relative(root, join(examplesRoot, file))}`)
  }
}

if (failed) process.exit(1)
console.log(`Validated ${schemas.length} schema files and ${checks.length} examples.`)
