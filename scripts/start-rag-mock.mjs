import { createRagMockServer } from '../server/mocks/ragMockServer.js'

const port = Number(process.env.RAG_MOCK_PORT ?? 8787)
const server = createRagMockServer({ requireAuth: process.env.MOCK_REQUIRE_AUTH === 'true' })
server.listen(port, '127.0.0.1', () => {
  console.log(`RAG mock listening at http://127.0.0.1:${port}`)
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
