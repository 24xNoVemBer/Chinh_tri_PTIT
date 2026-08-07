export function createRestoreRuntimeEnvironment(env = process.env) {
  if (!env.RESTORE_DATABASE_URL) throw new Error('RESTORE_DATABASE_URL is required.')
  return Object.freeze({
    ...env,
    NODE_ENV: 'production',
    DATABASE_DRIVER: 'postgres',
    DATABASE_URL: env.RESTORE_DATABASE_URL,
    DATABASE_SSL_MODE: env.RESTORE_DATABASE_SSL_MODE ?? 'verify-full',
    DATABASE_SSL_CA_PATH: env.RESTORE_DATABASE_SSL_CA_PATH ?? '',
    DATABASE_APPLICATION_NAME: env.RESTORE_DATABASE_APPLICATION_NAME ?? 'ptit-restore-drill',
    RAG_ENABLED: 'false',
    RAG_DEMO_DATA: 'false',
  })
}

export function createRestoreConfirmationEnvironment(env = process.env) {
  return Object.freeze({
    DATABASE_CONFIRM_HOST: env.RESTORE_CONFIRM_HOST ?? '',
    DATABASE_CONFIRM_NAME: env.RESTORE_CONFIRM_NAME ?? '',
    DATABASE_CONFIRM_USER: env.RESTORE_CONFIRM_USER ?? '',
    DATABASE_ALLOW_PRODUCTION_ADMIN: 'false',
  })
}

export function assertDisposableRestoreTarget(sourceManifest, target, env = process.env) {
  if (env.RESTORE_CONFIRM_DISPOSABLE !== 'true' || env.RESTORE_CONFIRM_CLEAN !== 'true') {
    throw new Error(
      'Restore drill requires RESTORE_CONFIRM_DISPOSABLE=true and RESTORE_CONFIRM_CLEAN=true.',
    )
  }
  if (!target || !sourceManifest?.database) {
    throw new Error('Restore drill requires source manifest and confirmed target identity.')
  }
  if (!/(restore|drill|disposable|temporary|tmp)/i.test(target.database)) {
    throw new Error('Restore target database name must identify a restore/drill/disposable target.')
  }
  if (target.database === sourceManifest.database.database) {
    throw new Error('Restore target database must differ from the source backup database.')
  }
  return Object.freeze({
    sourceDatabase: sourceManifest.database.database,
    targetDatabase: target.database,
    targetHost: target.host,
  })
}
