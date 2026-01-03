import type { PoolClient } from 'pg'

import * as path from 'node:path'
import * as url from 'node:url'
import fs from 'fs/promises'

import getClientQueries from './utils/getClientQueries.ts'
import getAllQueries from './utils/getAllQueries.ts'
import getEnvironmentVariable from './utils/env.ts'
import getRoot from './utils/getRoot.ts'
import getAllFilesInFolder from './utils/getAllFilesInFolder.ts'
import getVersionFromLocation from './utils/getVersionFromLocation.ts'
import getPositionFromLocation from './utils/getPositionFromLocation.ts'

import { parse } from 'pgsql-ast-parser'
import { Client, Pool } from 'pg'
import semver from 'semver'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const __root = getRoot()
const extensions = ['.sql', '.pgsql']
const pool = await executeDatabaseSetup()

export default pool

const c = await pool.connect()
console.log((await c.sql.now()).rows)

c.release()
pool.end()

/**
 * Runs all migrations.
 */
async function executeDatabaseSetup (SUPABASE_PROJECT_REF?: string, SUPABASE_PASSWORD?: string, SUPABASE_HOST?: string) : Promise<{ connect: typeof connect } & Pool> {
  SUPABASE_PROJECT_REF = SUPABASE_PROJECT_REF || getEnvironmentVariable('SUPABASE_PROJECT_REF')
  SUPABASE_PASSWORD = SUPABASE_PASSWORD || getEnvironmentVariable('SUPABASE_PASSWORD')
  SUPABASE_HOST = SUPABASE_HOST || getEnvironmentVariable('SUPABASE_HOST')
  const SUPABASE_CONNECTION_STRING = `postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:5432/postgres`

  const client = new Client({
    connectionString: SUPABASE_CONNECTION_STRING,
    ssl: {
      rejectUnauthorized: false
    },
  })

  await client.connect()
  const run = getClientQueries(client, getAllQueries(path.join(__dirname, 'setup')))
  await run.create_migrations_table()

  const schemaFolder = path.join(__root, 'database')
  const files = (await getAllFilesInFolder(schemaFolder)).filter(file => extensions.includes(path.extname(file)))

  // map version to statements
  const versionStatementMap : Record<string, { file: string, pos: { line: number, column: number }, query: string }[]> = {}
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    const versionStatements = [...content.matchAll(/@version\s+([^ \n]+)/g)]
    const statements = parse(content, { locationTracking: true })
    for (const statement of statements) {
      const { start, end } = statement._location!
      const pos = getPositionFromLocation(content, start)
      const version = getVersionFromLocation(versionStatements, start)
      if (!versionStatementMap[version]) versionStatementMap[version] = []
      versionStatementMap[version].push({ file, pos, query: content.slice(start, end) })
    }
  }

  // get current migration version
  const { rows: currentMigrationVersionRows } = await run.get_current_migration_version()
  const currentVersion = currentMigrationVersionRows.length > 0 ? currentMigrationVersionRows[0].name : '0.0.0'

  // execute migrations
  let current: { file: string, pos: { line: number, column: number }, query: string } | null = null
  try {
    await client.query('BEGIN')
    const versions = Object.keys(versionStatementMap).sort((a, b) => semver.compare(a, b))
    for (const version of versions) {
      if (currentVersion === '0.0.0' || semver.gt(version, currentVersion)) {
        const statements = versionStatementMap[version]
        for (const statement of statements) {
          current = statement
          await client.query(statement.query)
        }
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        await run.record_migration_version(`${timestamp}`, version, statements)
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof Error && current) {
      error.message = error.message + `\n    in file://${current.file}:${current.pos.line}:${current.pos.column}`
    }
    throw error
  }
  await client.end()

  const pool = new Pool({
    connectionString: SUPABASE_CONNECTION_STRING,
    ssl: {
      rejectUnauthorized: false
    },
  })

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
  client.sql = client.sql || getClientQueries(client, getAllQueries(path.join(__root, 'database', 'sql')))
  return client
}
