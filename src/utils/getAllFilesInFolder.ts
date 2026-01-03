import { readdir } from 'fs/promises'
import { join } from 'path'

export default async function getAllFilesInFolder (folderPath: string): Promise<string[]> {
  const entries = await readdir(folderPath, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(folderPath, entry.name))
}
