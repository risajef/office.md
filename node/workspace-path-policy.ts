import { promises as fs } from 'node:fs'
import path from 'node:path'

export const resolveWorkspaceTarget = async (root: string, name: string) => {
  const normalizedName = name.replaceAll('\\', '/')
  const parts = normalizedName.split('/')
  if (
    !normalizedName ||
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))
  ) {
    throw new Error('The path is invalid.')
  }
  const target = path.resolve(root, normalizedName)
  const relative = path.relative(root, target)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('The file path must stay inside the open folder.')
  }
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    try {
      const entry = await fs.lstat(current)
      if (entry.isSymbolicLink()) {
        throw new Error('Workspace paths must not contain a symbolic link.')
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') break
      throw error
    }
  }
  return target
}
