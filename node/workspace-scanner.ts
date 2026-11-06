import { promises as fs } from 'node:fs'
import path from 'node:path'
import { isEditableTextFile, isImageFile, shouldSkipDirectory } from '../src/editable-files'
import { createWorkspaceBudget, type WorkspaceLimits } from '../src/workspace-budget'
import type { WorkspaceFileSnapshot } from '../src/workspace-port'

export const createWorkspaceScanner = (root: string, limits?: Partial<WorkspaceLimits>) => {
  let cache = new Map<string, { stamp: string; markdown: string }>()
  return {
    async scan(force = false) {
      const budget = createWorkspaceBudget(limits)
      const next = new Map<string, { stamp: string; markdown: string }>()
      const files: WorkspaceFileSnapshot[] = []
      const directories: string[] = []
      const visit = async (relative: string, depth: number): Promise<void> => {
        for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
          const name = relative ? `${relative}/${entry.name}` : entry.name
          if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
            budget.entry(depth + 1)
            directories.push(name)
            await visit(name, depth + 1)
          } else if (entry.isFile() && (isEditableTextFile(entry.name) || isImageFile(entry.name))) {
            const image = isImageFile(entry.name)
            const target = path.join(root, name)
            const stats = await fs.lstat(target, { bigint: true })
            if (!stats.isFile()) throw new Error('Workspace entries changed during the scan. Retry loading the folder.')
            budget.entry(depth, Number(stats.size), !image)
            const stamp = `${stats.ino}:${stats.mtimeNs}:${stats.ctimeNs}:${stats.size}`
            const previous = cache.get(name)
            const markdown = image ? '' : !force && previous?.stamp === stamp
              ? previous.markdown : await fs.readFile(target, 'utf8')
            next.set(name, { stamp, markdown })
            files.push({ name, markdown })
          }
        }
      }
      await visit('', 0)
      cache = next
      return {
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
        directories: directories.sort((a, b) => a.localeCompare(b)),
      }
    },
  }
}
