import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'
import { parse } from 'yaml'

const root = process.cwd()
const dir = join(root, 'contracts', 'openapi')
const files = (await readdir(dir)).filter((file) => file.endsWith('.yaml'))
let failed = false
for (const file of files) {
  const path = join(dir, file)
  const document = parse(await readFile(path, 'utf8'))
  const problems = []
  if (document?.openapi !== '3.1.0') problems.push('openapi must be 3.1.0')
  if (!document?.info?.title || !document?.info?.version)
    problems.push('info.title and info.version are required')
  if (!document?.paths || Object.keys(document.paths).length === 0)
    problems.push('at least one path is required')
  for (const [route, operations] of Object.entries(document.paths ?? {})) {
    if (!route.startsWith('/')) problems.push(`invalid path ${route}`)
    for (const [method, operation] of Object.entries(operations ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      if (!operation?.operationId || !operation?.responses)
        problems.push(`${method.toUpperCase()} ${route} needs operationId and responses`)
    }
  }
  if (problems.length) {
    failed = true
    console.error(`INVALID ${relative(root, path)}\n- ${problems.join('\n- ')}`)
  } else console.log(`OK ${relative(root, path)}`)
}
if (failed) process.exit(1)
console.log(`Validated ${files.length} OpenAPI documents offline.`)
