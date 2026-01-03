import * as process from 'node:process'
import * as path from 'node:path'
import * as fs from 'node:fs'

const folders = ['database']
let rootDir: string | null = null

/**
 * Gets the parent directory of where `database` is located
 * @returns {string} The directory path or null if not found.
 */
export default function getRootDir (): string {
  if (rootDir) return rootDir

  const cwd = process.cwd().split(path.sep)
  for (let i = cwd.length - 1; i >= 0; i--) {
    const dir = path.resolve(...cwd.slice(0, i + 1))
    for (const folder of folders) {
      if (fs.existsSync(path.join(dir, folder))) {
        rootDir = dir
        return dir
      }
    }
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      break
    }
  }

  throw new Error(`Root directory not found. Expected "${path.resolve(cwd.join(path.sep), folders[0])}" to exist.`)
}
