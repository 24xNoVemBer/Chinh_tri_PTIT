// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRuntimeConfig } from './runtimeConfig.js'

describe('database runtime configuration', () => {
  it('keeps SQLite as the default adapter', () => {
    const config = createRuntimeConfig({ NODE_ENV: 'test', PORT: '3001' })
    expect(config.database).toMatchObject({
      driver: 'sqlite',
      url: '',
      poolMax: 10,
    })
    expect(config.rag.demoData).toBe(true)
  })

  it('requires a URL before selecting PostgreSQL', () => {
    expect(() =>
      createRuntimeConfig({ DATABASE_DRIVER: 'postgres', NODE_ENV: 'test', PORT: '3001' }),
    ).toThrow('DATABASE_URL is required')

    const config = createRuntimeConfig({
      DATABASE_DRIVER: 'postgres',
      DATABASE_URL: 'postgres://localhost/ptit',
      DATABASE_POOL_MAX: '24',
      NODE_ENV: 'test',
      PORT: '3001',
    })
    expect(config.database).toMatchObject({ driver: 'postgres', poolMax: 24 })
    expect(createRuntimeConfig({ NODE_ENV: 'production', PORT: '3001' }).rag.demoData).toBe(false)
  })
})
