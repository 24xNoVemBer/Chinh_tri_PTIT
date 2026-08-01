import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const schemaRoot = join(process.cwd(), 'contracts', 'schemas')
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? collect(path) : [path]
  })
}

for (const file of collect(schemaRoot).filter((path) => path.endsWith('.json'))) {
  ajv.addSchema(JSON.parse(readFileSync(file, 'utf8')))
}

export class ContractValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ContractValidationError'
    this.errors = errors
  }
}

export function validateSchema(schemaId, payload) {
  const validate = ajv.getSchema(schemaId)
  if (!validate) throw new Error(`Unknown contract schema: ${schemaId}`)
  const valid = validate(payload)
  return { valid, errors: validate.errors ?? [] }
}

export function assertSchema(schemaId, payload) {
  const result = validateSchema(schemaId, payload)
  if (!result.valid)
    throw new ContractValidationError(`Payload does not match ${schemaId}`, result.errors)
  return payload
}

export const schemaIds = {
  request: 'https://contracts.ptit-chinh-tri.local/schemas/chat/create-chat-request.schema.json',
  answer: 'https://contracts.ptit-chinh-tri.local/schemas/chat/terminal-answer.schema.json',
  event: 'https://contracts.ptit-chinh-tri.local/schemas/chat/chat-event.schema.json',
  feedback: 'https://contracts.ptit-chinh-tri.local/schemas/chat/feedback.schema.json',
  material:
    'https://contracts.ptit-chinh-tri.local/schemas/ingestion/material-manifest.schema.json',
}

export function validateRequestScope(request) {
  const classes = new Set(request.scope.classIds)
  if (classes.size !== request.scope.classIds.length) {
    throw new ContractValidationError('scope.classIds must not contain duplicates')
  }
  return request.scope.allowedMaterialVersionIds
}

export function validateAnswerScope(answer, allowedMaterialVersionIds) {
  const allowed = new Set(allowedMaterialVersionIds)
  for (const citation of answer.citations ?? []) {
    if (!allowed.has(citation.materialVersionId)) {
      throw new ContractValidationError(
        'Citation is outside the authorized material version allow-list',
      )
    }
    if (/https?:\/\/|<script|javascript:/i.test(citation.quote)) {
      throw new ContractValidationError('Citation quote contains an unsafe URL/script marker')
    }
  }
  if (answer.outcome === 'answered' && answer.citations.length === 0) {
    throw new ContractValidationError('Answered response must include at least one citation')
  }
  return answer
}

export function validateEventSequence(events) {
  let last = 0
  let terminalCount = 0
  for (const event of events) {
    assertSchema(schemaIds.event, event)
    if (event.sequence <= last)
      throw new ContractValidationError('Event sequence must be strictly increasing')
    last = event.sequence
    if (event.type === 'terminal' || event.type === 'error') terminalCount += 1
  }
  if (terminalCount > 1)
    throw new ContractValidationError('A request can have only one terminal event')
  return events
}
