import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type StyleFolderPreferenceStore = {
  load: () => Promise<string | undefined>
  remember: (folderPath: string) => Promise<void>
  clear: () => Promise<void>
}

const isPathValue = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim())

export const createStyleFolderPreferenceStore = (
  filePath: string,
): StyleFolderPreferenceStore => ({
  async load() {
    try {
      const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown
      if (!value || typeof value !== 'object') return undefined
      const folderPath = (value as { path?: unknown }).path
      return isPathValue(folderPath) ? folderPath : undefined
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return undefined
      }
      // A preference is optional state. Malformed or partially written data
      // is treated as stale rather than preventing the editor from starting.
      return undefined
    }
  },
  async remember(folderPath) {
    if (!isPathValue(folderPath)) throw new Error('The style folder path is invalid.')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const temporary = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${randomUUID()}.tmp`,
    )
    try {
      await fs.writeFile(temporary, JSON.stringify({ path: folderPath }), 'utf8')
      await fs.rename(temporary, filePath)
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  },
  async clear() {
    await fs.rm(filePath, { force: true })
  },
})
