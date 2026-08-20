const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist'])
const WORKSPACE_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.md',
  '.markdown',
])

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export const isEditableTextFile = (name: string) => {
  const parts = name.replaceAll('\\', '/').split('/')
  return !parts.some((part) => part.startsWith('.')) &&
    WORKSPACE_EXTENSIONS.has(extensionOf(name))
}

export const shouldSkipDirectory = (name: string) =>
  name.startsWith('.') || SKIPPED_DIRECTORIES.has(name)
