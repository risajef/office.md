export type StyleFolderInfo = {
  id: string
  name: string
  path: string
}

export type StyleFileSnapshot = {
  id: string
  name: string
  contents: string
}

export type StyleFolderSnapshot = {
  folder: StyleFolderInfo
  files: StyleFileSnapshot[]
}

export type StyleFolderPortHost = 'web' | 'electron' | 'memory'

export type StyleFolderBackend = {
  readonly name: string
  isAvailable: () => Promise<boolean>
  open: () => Promise<StyleFolderSnapshot | undefined>
  restore: () => Promise<StyleFolderSnapshot | undefined>
  reload: () => Promise<StyleFolderSnapshot>
  readFile: (name: string) => Promise<string>
}

export type StyleFolderPort = {
  readonly host: StyleFolderPortHost
  readonly folder: StyleFolderInfo | undefined
  open: () => Promise<StyleFolderSnapshot | undefined>
  restore: () => Promise<StyleFolderSnapshot | undefined>
  reload: () => Promise<StyleFolderSnapshot>
  readFile: (name: string) => Promise<string>
}

export type MemoryStyleFileSeed = {
  name: string
  contents: string
}

export type MemoryStyleFolderSeed = {
  path: string
  name: string
  files: MemoryStyleFileSeed[]
  openError?: string
  readErrors?: Record<string, string>
}

export const STYLE_FOLDER_SOURCE = 'style-folder'

const invalidStylePath = () => new Error('The style file path is invalid.')

export const normalizeStyleFilePath = (name: string) => {
  const normalized = name.trim().replaceAll('\\', '/')
  const parts = normalized.split('/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:\//i.test(normalized) ||
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.')) ||
    !normalized.toLowerCase().endsWith('.css')
  ) {
    throw invalidStylePath()
  }
  return parts.join('/')
}

const isVisibleCssPath = (name: string) => {
  try {
    normalizeStyleFilePath(name)
    return true
  } catch {
    return false
  }
}

const copyFolder = (folder: StyleFolderInfo): StyleFolderInfo => ({ ...folder })

const copySnapshot = (snapshot: StyleFolderSnapshot): StyleFolderSnapshot => ({
  folder: copyFolder(snapshot.folder),
  files: snapshot.files.map((file) => ({ ...file })),
})

/**
 * Normalize host results at the capability boundary. Hosts may discover
 * arbitrary directory entries, but the product only exposes visible CSS
 * files and gives every file an identity qualified by its selected source.
 */
export const normalizeStyleFolderSnapshot = (
  snapshot: StyleFolderSnapshot,
): StyleFolderSnapshot => {
  const files = snapshot.files
    .filter((file) => typeof file.name === 'string' && isVisibleCssPath(file.name))
    .map((file) => {
      const name = normalizeStyleFilePath(file.name)
      return {
        id: `${STYLE_FOLDER_SOURCE}:${snapshot.folder.id}/${name}`,
        name,
        contents: file.contents,
      }
    })
    .filter((file) => typeof file.contents === 'string')
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    folder: copyFolder(snapshot.folder),
    files,
  }
}

const createPortFromBackends = (
  host: StyleFolderPortHost,
  backends: StyleFolderBackend[],
): StyleFolderPort => {
  let activeBackend: StyleFolderBackend | undefined
  let currentFolder: StyleFolderInfo | undefined

  const setActiveBackend = (
    backend: StyleFolderBackend,
    snapshot: StyleFolderSnapshot,
  ) => {
    const normalized = normalizeStyleFolderSnapshot(snapshot)
    activeBackend = backend
    currentFolder = copyFolder(normalized.folder)
    return normalized
  }

  const requireBackend = () => {
    if (!activeBackend || !currentFolder) {
      throw new Error('The style folder is not selected.')
    }
    return activeBackend
  }

  return {
    host,
    get folder() {
      return currentFolder ? copyFolder(currentFolder) : undefined
    },
    async open() {
      for (const backend of backends) {
        if (!await backend.isAvailable()) continue
        const snapshot = await backend.open()
        if (snapshot) return setActiveBackend(backend, snapshot)
        return undefined
      }
      throw new Error('No supported style-folder access is available.')
    },
    async restore() {
      for (const backend of backends) {
        if (!await backend.isAvailable()) continue
        try {
          const snapshot = await backend.restore()
          if (snapshot) return setActiveBackend(backend, snapshot)
        } catch {
          // A stale remembered folder should not prevent another host path
          // from being offered or the document workspace from opening.
        }
      }
      return undefined
    },
    async reload() {
      const backend = requireBackend()
      return setActiveBackend(backend, await backend.reload())
    },
    async readFile(name) {
      normalizeStyleFilePath(name)
      return requireBackend().readFile(name)
    },
  }
}

export const createBackendStyleFolderPort = (
  host: StyleFolderPortHost,
  backends: StyleFolderBackend[],
) => createPortFromBackends(host, backends)

/** Deterministic style source used by application and contract tests. */
export const createMemoryStyleFolderPort = (
  seed: MemoryStyleFolderSeed,
): StyleFolderPort => {
  const folder: StyleFolderInfo = {
    id: `memory:${seed.path}`,
    name: seed.name,
    path: seed.path,
  }
  const source = normalizeStyleFolderSnapshot({
    folder,
    files: seed.files.map((file) => ({
      id: '',
      name: file.name,
      contents: file.contents,
    })),
  })
  const contents = new Map(source.files.map((file) => [file.name, file.contents]))
  let opened = false

  const requireOpen = () => {
    if (!opened) throw new Error('The style folder is not selected.')
  }
  const snapshot = () => copySnapshot({
    folder,
    files: source.files.map((file) => ({
      ...file,
      contents: contents.get(file.name) ?? file.contents,
    })),
  })

  return {
    host: 'memory',
    get folder() {
      return opened ? copyFolder(folder) : undefined
    },
    async open() {
      if (seed.openError) throw new Error(seed.openError)
      opened = true
      return snapshot()
    },
    async restore() {
      if (!opened) return undefined
      return snapshot()
    },
    async reload() {
      requireOpen()
      if (seed.openError) throw new Error(seed.openError)
      return snapshot()
    },
    async readFile(name) {
      requireOpen()
      const normalized = normalizeStyleFilePath(name)
      const error = seed.readErrors?.[normalized]
      if (error) throw new Error(error)
      const value = contents.get(normalized)
      if (value === undefined) throw new Error(`The style file ${normalized} was not found.`)
      return value
    },
  }
}
