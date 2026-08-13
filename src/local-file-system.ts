export type LocalWritable = {
  write: (contents: string) => Promise<void>
  close: () => Promise<void>
}

export type LocalFileHandle = {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<LocalWritable>
}

export type LocalDirectoryHandle = {
  kind: 'directory'
  name: string
  entries: () => AsyncIterableIterator<[string, LocalEntryHandle]>
  getFileHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<LocalFileHandle>
}

export type LocalEntryHandle = LocalFileHandle | LocalDirectoryHandle

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<LocalDirectoryHandle>
}

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

export type LocalTextFile = {
  name: string
  markdown: string
  handle: LocalFileHandle
}

export const pickLocalDirectory = async () => {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) {
    throw new Error(
      'Folder access is not available in this browser. Use a recent Chromium-based browser over HTTPS or localhost.',
    )
  }

  try {
    return await picker()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return undefined
    }
    throw error
  }
}

export const readLocalTextFiles = async (
  directory: LocalDirectoryHandle,
  prefix = '',
): Promise<LocalTextFile[]> => {
  const files: LocalTextFile[] = []

  for await (const [name, entry] of directory.entries()) {
    if (entry.kind === 'directory') {
      if (SKIPPED_DIRECTORIES.has(name)) continue
      files.push(...(await readLocalTextFiles(entry, `${prefix}${name}/`)))
      continue
    }

    if (!isEditableTextFile(name)) continue
    const file = await entry.getFile()
    files.push({
      name: `${prefix}${name}`,
      markdown: await file.text(),
      handle: entry,
    })
  }

  return files.sort((left, right) => left.name.localeCompare(right.name))
}

export const readLocalCssFiles = async (directory: LocalDirectoryHandle) => {
  const files = await readLocalTextFiles(directory)
  return files.filter((file) => extensionOf(file.name) === '.css')
}

export const writeLocalTextFile = async (
  file: LocalTextFile | { handle: LocalFileHandle; markdown: string },
) => {
  const writable = await file.handle.createWritable()
  await writable.write(file.markdown)
  await writable.close()
}
