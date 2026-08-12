import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createDatabase } from '../server/database.js'
import { assertDemoSeedAllowed, seedLargeDemoData } from '../server/db/demoSeed.js'
import { createPostgresClient } from '../server/db/postgres.js'
import { createPostgresPoolOptions } from '../server/db/runtime.js'
import {
  resolveConfirmedPostgresTarget,
  verifyConnectedPostgresTarget,
} from '../server/db/targetSafety.js'
import { createRuntimeConfig } from '../server/runtimeConfig.js'

if (existsSync('.env')) process.loadEnvFile('.env')

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { 'confirm-demo-seed': { type: 'boolean', default: false } },
  allowPositionals: false,
  strict: true,
})
const config = createRuntimeConfig()
assertDemoSeedAllowed({
  nodeEnv: config.nodeEnv,
  confirmed: values['confirm-demo-seed'],
})
let db

try {
  if (config.database.driver === 'postgres') {
    const target = resolveConfirmedPostgresTarget(config.database.url, process.env, {
      operation: 'demo data seeding',
    })
    db = createPostgresClient({
      connectionString: config.database.url,
      poolOptions: createPostgresPoolOptions(config.database, { administrative: true }),
    })
    await verifyConnectedPostgresTarget(db, target)
  } else {
    db = createDatabase({ databasePath: config.databasePath, seed: true })
  }

  const counts = await seedLargeDemoData(db, {
    nodeEnv: config.nodeEnv,
    confirmed: values['confirm-demo-seed'],
  })
  console.log(JSON.stringify({ status: 'seeded', driver: config.database.driver, counts }, null, 2))
} finally {
  await db?.close()
}
