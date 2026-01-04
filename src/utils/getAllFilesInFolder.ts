import * as fs from 'fs'
import { join } from 'path'

export default async function getAllFilesInFolder (folderPath: string): Promise<string[]> {
  if (!fs.existsSync(folderPath)) return []
  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(folderPath, entry.name))
}
