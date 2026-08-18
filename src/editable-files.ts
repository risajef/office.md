const BINARY_EXTENSIONS = new Set([
  '.7z',
  '.avi',
  '.bmp',
  '.class',
  '.dll',
  '.dmg',
  '.doc',
  '.docx',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.otf',
  '.pdf',
  '.png',
  '.so',
  '.tar',
  '.tif',
  '.ttf',
  '.wav',
  '.webp',
  '.woff',
  '.woff2',
  '.xls',
  '.xlsx',
  '.zip',
])

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist'])

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export const isEditableTextFile = (name: string) =>
  !BINARY_EXTENSIONS.has(extensionOf(name))

export const shouldSkipDirectory = (name: string) =>
  SKIPPED_DIRECTORIES.has(name)
