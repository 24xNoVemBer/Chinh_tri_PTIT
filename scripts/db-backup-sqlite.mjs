import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

function quoteSqliteString(value) {
  return "'" + String(value).replaceAll("'", "''") + "'"
}

export function backupSqliteDatabase(sourcePath, destinationPath) {
  const source = resolve(sourcePath)
  const destination = resolve(destinationPath)

  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error('SQLite source does not exist or is not a file: ' + source)
  }
  if (source.toLowerCase() === destination.toLowerCase()) {
    throw new Error('SQLite backup must not overwrite its source database.')
  }
  if (existsSync(destination)) {
    throw new Error('SQLite backup destination already exists: ' + destination)
  }

  mkdirSync(dirname(destination), { recursive: true })

  const sourceDb = new DatabaseSync(source, { readOnly: true })
  try {
    sourceDb.exec('VACUUM INTO ' + quoteSqliteString(destination))
  } finally {
    sourceDb.close()
  }

  const backupDb = new DatabaseSync(destination, { readOnly: true })
  try {
    const integrity = backupDb.prepare('PRAGMA integrity_check').get()
    if (integrity.integrity_check !== 'ok') {
      throw new Error('SQLite backup failed integrity_check: ' + integrity.integrity_check)
    }
  } finally {
    backupDb.close()
  }

  return destination
}

const sourcePath = process.argv[2] ?? process.env.DATABASE_PATH
const destinationPath = process.argv[3]

if (!sourcePath || !destinationPath) {
  throw new Error(
    'Usage: npm run db:backup:sqlite -- <source.sqlite> <destination.sqlite>',
  )
}

const backupPath = backupSqliteDatabase(sourcePath, destinationPath)
console.log('SQLite backup created and integrity-checked: ' + backupPath)
