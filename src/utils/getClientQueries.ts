import type { PoolClient, Client, QueryResult } from 'pg'
import type { Query } from './getAllQueries.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryFunctionResult = Promise<QueryResult<any>>
type QueryFunction = (...args: unknown[]) => QueryFunctionResult

export default function getClientQueries (client: Client | PoolClient, queries: Query[]): Record<string, QueryFunction> {
  const results: Record<string, QueryFunction> = {}

  for (const query of queries) {
    results[query.cmd] = (...params: unknown[]) : QueryFunctionResult => client.query(query.content, params)
  }

  return results
}
