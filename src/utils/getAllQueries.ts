import * as fs from 'fs'
import * as path from 'path'

export type Query = {
  cmd: string
  content: string
}

/**
 * Recursively reads all files in a directory and returns their paths
 * with path separators replaced by underscores.
 * @param dir The directory to read.
 * @returns Array of file paths with separators replaced.
 */
export default function getAllQueries (dir: string): Query[] {
  const queries: Query[] = []

  function readDirRecursive (currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        readDirRecursive(fullPath)
      } else if (entry.isFile()) {
        const relativePath = path.relative(dir, fullPath)
        const ext = path.extname(relativePath)
        queries.push({ cmd: relativePath.split(path.sep).join('_').slice(0, -ext.length), content: fs.readFileSync(fullPath, 'utf-8') })
      }
    }
  }

  readDirRecursive(dir)
  return queries
}
