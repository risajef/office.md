const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist'])
const WORKSPACE_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.md',
  '.markdown',
])
const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.tif',
  '.tiff',
  '.webp',
])

const hasVisiblePath = (name: string) => {
  const parts = name.replaceAll('\\', '/').split('/')
  return !parts.some((part) => part.startsWith('.'))
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export const isEditableTextFile = (name: string) => {
  return hasVisiblePath(name) &&
    WORKSPACE_EXTENSIONS.has(extensionOf(name))
}

export const isImageFile = (name: string) =>
  hasVisiblePath(name) && IMAGE_EXTENSIONS.has(extensionOf(name))

export const isWorkspaceFile = (name: string) =>
  isEditableTextFile(name) || isImageFile(name)

export const imageMimeType = (name: string) => {
  const types: Record<string, string> = {
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp',
  }
  return types[extensionOf(name)] ?? 'application/octet-stream'
}

export const shouldSkipDirectory = (name: string) =>
  name.startsWith('.') || SKIPPED_DIRECTORIES.has(name)
