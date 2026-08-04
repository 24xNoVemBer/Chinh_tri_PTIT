import { createDatabase } from '../server/database.js'

const databasePath = process.env.DATABASE_PATH ?? ':memory:'
const seed = process.env.DB_BASELINE_SEED !== 'false'
const db = createDatabase({ databasePath, seed })

try {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()

  const report = {
    database: 'sqlite',
    databasePath,
    seeded: seed,
    tables: tables.map(({ name }) => {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all()
      const count = db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get().count

      return {
        name,
        rowCount: Number(count),
        columns: columns.map((column) => ({
          name: column.name,
          type: column.type,
          required: Boolean(column.notnull),
          primaryKey: Boolean(column.pk),
        })),
      }
    }),
    indexes: db
      .prepare(
        "SELECT name, tbl_name AS tableName, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY tbl_name, name",
      )
      .all(),
  }

  console.log(JSON.stringify(report, null, 2))
} finally {
  db.close()
}
