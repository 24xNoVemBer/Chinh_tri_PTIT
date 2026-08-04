import { randomUUID } from 'node:crypto'

const nowIso = () => new Date().toISOString()

export async function writeAudit(client, actorId, action, entityType, entityId, metadata = null) {
  if (!client || typeof client.execute !== 'function') {
    throw new Error('writeAudit requires a database client with execute().')
  }

  return client.execute(
    `INSERT INTO audit_logs
     (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `audit_${randomUUID()}`,
      actorId ?? null,
      action,
      entityType,
      entityId ?? null,
      metadata ? JSON.stringify(metadata) : null,
      nowIso(),
    ],
  )
}
