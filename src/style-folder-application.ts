import type {
  StyleFileSnapshot,
  StyleFolderInfo,
  StyleFolderPort,
  StyleFolderSnapshot,
} from './style-folder-port'

export type StyleFolderApplicationState = {
  folder: StyleFolderInfo | undefined
  files: StyleFileSnapshot[]
}

export type StyleFolderApplication = {
  readonly state: StyleFolderApplicationState
  open: () => Promise<StyleFolderSnapshot | undefined>
  restore: () => Promise<StyleFolderSnapshot | undefined>
  reload: () => Promise<StyleFolderSnapshot>
  readFile: (name: string) => Promise<string>
  file: (name: string) => StyleFileSnapshot | undefined
  clear: () => void
}

const copySnapshot = (snapshot: StyleFolderSnapshot): StyleFolderSnapshot => ({
  folder: { ...snapshot.folder },
  files: snapshot.files.map((file) => ({ ...file })),
})

const copyState = (
  snapshot: StyleFolderSnapshot | undefined,
): StyleFolderApplicationState => ({
  folder: snapshot ? { ...snapshot.folder } : undefined,
  files: snapshot?.files.map((file) => ({ ...file })) ?? [],
})

const findFile = (
  snapshot: StyleFolderSnapshot | undefined,
  requestedName: string,
) => {
  const requested = requestedName.trim().replaceAll('\\', '/').replace(/^\.\//, '')
  const files = snapshot?.files ?? []
  const exact = files.find((file) => file.name === requested)
  if (exact) return exact
  const suffixMatches = files.filter((file) => file.name.endsWith(`/${requested}`))
  return suffixMatches.length === 1 ? suffixMatches[0] : undefined
}

export const createStyleFolderApplication = (
  port: StyleFolderPort,
): StyleFolderApplication => {
  let currentSnapshot: StyleFolderSnapshot | undefined

  const setSnapshot = (snapshot: StyleFolderSnapshot) => {
    currentSnapshot = copySnapshot(snapshot)
    return copySnapshot(currentSnapshot)
  }

  return {
    get state() {
      return copyState(currentSnapshot)
    },
    async open() {
      const snapshot = await port.open()
      return snapshot ? setSnapshot(snapshot) : undefined
    },
    async restore() {
      const snapshot = await port.restore()
      return snapshot ? setSnapshot(snapshot) : undefined
    },
    async reload() {
      return setSnapshot(await port.reload())
    },
    readFile: (name) => port.readFile(name),
    file(name) {
      const file = findFile(currentSnapshot, name)
      return file ? { ...file } : undefined
    },
    clear() {
      currentSnapshot = undefined
    },
  }
}
