import type { PoolClient } from 'pg'

import * as path from 'node:path'
import * as url from 'node:url'
import fs from 'fs/promises'

import getClientQueries from './utils/getClientQueries.ts'
import getAllQueries from './utils/getAllQueries.ts'
import getEnvironmentVariable from './utils/env.ts'
import getRoot from './utils/getRoot.ts'
import getAllFilesInFolder from './utils/getAllFilesInFolder.ts'

import { Pool } from 'pg'
import semver from 'semver'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const __root = getRoot()
const extensions = ['.sql', '.pgsql']
const pool = await executeDatabaseSetup()

export default pool

/**
 * Runs all migrations.
 */
async function executeDatabaseSetup (SUPABASE_PROJECT_REF?: string, SUPABASE_PASSWORD?: string, SUPABASE_HOST?: string) : Promise<{ connect: typeof connect } & Pool> {
  SUPABASE_PROJECT_REF = SUPABASE_PROJECT_REF || getEnvironmentVariable('SUPABASE_PROJECT_REF')
  SUPABASE_PASSWORD = SUPABASE_PASSWORD || getEnvironmentVariable('SUPABASE_PASSWORD')
  SUPABASE_HOST = SUPABASE_HOST || getEnvironmentVariable('SUPABASE_HOST')

  if (!SUPABASE_PROJECT_REF) throw new Error('Missing "SUPABASE_PROJECT_REF" environment variable.')
  if (!SUPABASE_PASSWORD) throw new Error('Missing "SUPABASE_PASSWORD" environment variable.')
  if (!SUPABASE_HOST) throw new Error('Missing "SUPABASE_HOST" environment variable.')

  let setupPool: Pool
  let client: PoolClient
  let tries = 0
  while (true) {
    try {
      setupPool = new Pool({
        user: `postgres.${SUPABASE_PROJECT_REF}`,
        host: SUPABASE_HOST,
        database: 'postgres',
        password: SUPABASE_PASSWORD,
        port: 5432,
        ssl: { rejectUnauthorized: false }
      })
      client = await setupPool.connect()
      tries++
      break
    } catch (err) {
      if (tries >= 5) throw err
      await new Promise((resolve) => setTimeout(resolve, 1000 * tries))
      continue
    }
  }

  if (!setupPool || !client) {
    throw new Error('Failed to create database pool or client.')
  }

  await client.connect()
  const run = getClientQueries(client, getAllQueries(path.join(__dirname, 'setup')))
  await run.create_migrations_table()

  const schemaFolder = path.join(__root, 'database')
  const rpcFolder = path.join(__root, 'database', 'rpc')
  const files = [
    ...(await getAllFilesInFolder(schemaFolder)).filter(file => extensions.includes(path.extname(file))),
    ...(await getAllFilesInFolder(rpcFolder)).filter(file => extensions.includes(path.extname(file))),
  ]

  // map version to statements
  const versionStatementMap : Record<string, { file: string, query: string }[]> = {}
  const add = (version: string, file: string, query: string) : void => {
    query = query.trim()
    while (query.startsWith('--\n')) query = query.slice(3).trim()
    while (query.endsWith('\n--')) query = query.slice(0, -3).trim()

    if (query.split('\n').every(line => line.trim().startsWith('--'))) return
    versionStatementMap[version] = versionStatementMap[version] || []
    versionStatementMap[version].push({ file, query })
  }

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    const versionComments = [...content.matchAll(/@version\s+([^ \n]+)/g)]
    if (versionComments.length === 0) {
      add('0.0.0', file, content)
      continue
    }
    if (versionComments[0].index !== 0) add('0.0.0', file, content.slice(0, versionComments[0].index))
    for (let i = 0; i < versionComments.length; i++) {
      const comment = versionComments[i]
      const version = comment[1]
      const start = comment.index
      const end = versionComments[i + 1] ? versionComments[i + 1].index : content.length
      const query = '-- ' + content.slice(start, end)
      add(version, file, query)
    }
  }

  // get current migration version
  const { rows: currentMigrationVersionRows } = await run.get_current_migration_version()
  const currentVersion = currentMigrationVersionRows[0]?.name || null

  // execute migrations
  let current: { file: string, query: string, version: string } | null = null
  try {
    await client.query('BEGIN')
    const versions = Object.keys(versionStatementMap).sort((a, b) => semver.compare(a, b))
    let i = 0
    for (const version of versions) {
      if (currentVersion === null || semver.gt(version, currentVersion)) {
        const statements = versionStatementMap[version]
        for (const statement of statements) {
          current = { ...statement, version }
          await client.query(statement.query)
        }
        i++
        const timestamp = Number(new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)) + i
        await run.record_migration_version(`${timestamp}`, version, statements)
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof Error && current) {
      error.message = error.message + `\n    in file://${current.file} (near @version ${current.version})`
    }
    throw error
  }
  client.release()

  const pool = setupPool
  const poolConnect = pool.connect.bind(pool)
  pool.connect = connect.bind(null, poolConnect)
  return pool as Pool & { connect: typeof connect }
}

/**
 *
 */
export async function connect (connect?: Pool['connect']) : Promise<PoolClient & { sql: ReturnType<typeof getClientQueries> }> {
  if (!connect) return await pool.connect()
  const client = await connect() as PoolClient & { sql: ReturnType<typeof getClientQueries> }
  client.sql = getClientQueries(client, getAllQueries(path.join(__root, 'database', 'sql')))
  return client
}
