import * as process from 'node:process'

export default function getEnvironmentVariable (key: string, defaultValue?: string): string {
  if (process.env[key]) return process.env[key] as string
  if (defaultValue) return defaultValue
  throw new Error(`Environment variable "${key}" is not set.`)
}
