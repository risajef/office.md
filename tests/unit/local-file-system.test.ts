import { describe, expect, it } from 'vitest'
import {
  createLocalDirectory,
  deleteLocalDirectory,
  deleteLocalTextFile,
  readLocalWorkspace,
  readLocalTextFiles,
  renameLocalTextFile,
  writeLocalTextFile,
  type LocalDirectoryHandle,
  type LocalEntryHandle,
  type LocalFileHandle,
} from '../../src/local-file-system'
import { isEditableTextFile, shouldSkipDirectory } from '../../src/editable-files'

class MemoryFile implements LocalFileHandle {
  readonly kind = 'file' as const
  permission: 'granted' | 'denied' | 'prompt' = 'granted'
  failWrite = false
  closed = false

  constructor(public name: string, public contents: string) {}

  getFile = async () => ({
    text: async () => this.contents,
  }) as File

  createWritable = async () => ({
    write: async (contents: string) => {
      if (this.failWrite) throw new Error('write failed')
      this.contents = contents
    },
    close: async () => { this.closed = true },
  })

  queryPermission = async () => this.permission
  requestPermission = async () => this.permission
}

class MemoryDirectory implements LocalDirectoryHandle {
  readonly kind = 'directory' as const
  entriesMap = new Map<string, LocalEntryHandle>()
  failRemoveFor = new Set<string>()

  constructor(public name: string) {}

  entries = async function* (this: MemoryDirectory) {
    yield* this.entriesMap.entries()
  }

  getDirectoryHandle = async (name: string, options?: { create?: boolean }) => {
    const current = this.entriesMap.get(name)
    if (current?.kind === 'directory') return current
    if (current || !options?.create) throw new DOMException('Not found', 'NotFoundError')
    const directory = new MemoryDirectory(name)
    this.entriesMap.set(name, directory)
    return directory
  }

  getFileHandle = async (name: string, options?: { create?: boolean }) => {
    const current = this.entriesMap.get(name)
    if (current?.kind === 'file') return current
    if (current || !options?.create) throw new DOMException('Not found', 'NotFoundError')
    const file = new MemoryFile(name, '')
    this.entriesMap.set(name, file)
    return file
  }

  removeEntry = async (name: string) => {
    if (this.failRemoveFor.has(name)) throw new Error('remove failed')
    if (!this.entriesMap.delete(name)) throw new DOMException('Not found', 'NotFoundError')
  }

  queryPermission = async () => 'granted' as const
  requestPermission = async () => 'granted' as const
}

describe('editable file filtering', () => {
  it('accepts supported workspace files and rejects other formats', () => {
    expect(isEditableTextFile('README.md')).toBe(true)
    expect(isEditableTextFile('README.markdown')).toBe(true)
    expect(isEditableTextFile('data.csv')).toBe(true)
    expect(isEditableTextFile('theme.css')).toBe(true)
    expect(isEditableTextFile('notes.txt')).toBe(false)
    expect(isEditableTextFile('.secret.md')).toBe(false)
    expect(isEditableTextFile('private/.secret.md')).toBe(false)
    expect(isEditableTextFile('photo.png')).toBe(false)
    expect(isEditableTextFile('report.pdf')).toBe(false)
    expect(isEditableTextFile('font.woff2')).toBe(false)
  })

  it('skips generated and dependency directories', () => {
    expect(shouldSkipDirectory('.git')).toBe(true)
    expect(shouldSkipDirectory('node_modules')).toBe(true)
    expect(shouldSkipDirectory('dist')).toBe(true)
    expect(shouldSkipDirectory('.cache')).toBe(true)
    expect(shouldSkipDirectory('notes')).toBe(false)
  })
})

describe('File System Access operations', () => {
  it('reads nested text files while skipping binary and generated content', async () => {
    const root = new MemoryDirectory('project')
    const notes = new MemoryDirectory('notes')
    const dependencies = new MemoryDirectory('node_modules')
    const hidden = new MemoryDirectory('.hidden')
    root.entriesMap.set('README.md', new MemoryFile('README.md', '# Read me'))
    root.entriesMap.set('.secret.md', new MemoryFile('.secret.md', 'hidden'))
    root.entriesMap.set('notes.txt', new MemoryFile('notes.txt', 'unsupported'))
    root.entriesMap.set('image.png', new MemoryFile('image.png', 'binary'))
    root.entriesMap.set('notes', notes)
    root.entriesMap.set('node_modules', dependencies)
    root.entriesMap.set('.hidden', hidden)
    notes.entriesMap.set('detail.md', new MemoryFile('detail.md', 'Detail'))
    dependencies.entriesMap.set('package.md', new MemoryFile('package.md', 'Skip'))
    hidden.entriesMap.set('secret.md', new MemoryFile('secret.md', 'Skip'))

    expect(await readLocalTextFiles(root)).toEqual([
      expect.objectContaining({ name: 'notes/detail.md', markdown: 'Detail' }),
      expect.objectContaining({ name: 'README.md', markdown: '# Read me' }),
    ])
  })

  it('lists directories and creates or deletes empty entries', async () => {
    const root = new MemoryDirectory('project')
    const empty = new MemoryDirectory('empty')
    root.entriesMap.set('empty', empty)
    root.entriesMap.set('notes.md', new MemoryFile('notes.md', 'Notes'))

    const workspace = await readLocalWorkspace(root)
    expect(workspace.directories).toEqual(['empty'])

    await createLocalDirectory(root, 'created')
    expect(root.entriesMap.get('created')?.kind).toBe('directory')
    await deleteLocalDirectory(root, 'created')
    expect(root.entriesMap.has('created')).toBe(false)
    await deleteLocalTextFile(root, 'notes.md')
    expect(root.entriesMap.has('notes.md')).toBe(false)
    await expect(deleteLocalDirectory(root, 'empty')).resolves.toBeUndefined()
  })

  it('refuses to delete non-empty folders', async () => {
    const root = new MemoryDirectory('project')
    const notes = new MemoryDirectory('notes')
    notes.entriesMap.set('detail.md', new MemoryFile('detail.md', 'Detail'))
    root.entriesMap.set('notes', notes)

    await expect(deleteLocalDirectory(root, 'notes')).rejects.toThrow('must be empty')
  })

  it('writes and closes a permitted file', async () => {
    const file = new MemoryFile('notes.md', 'old')
    await writeLocalTextFile({ handle: file, markdown: 'new' })
    expect(file.contents).toBe('new')
    expect(file.closed).toBe(true)
  })

  it('does not write when permission is denied', async () => {
    const file = new MemoryFile('notes.md', 'old')
    file.permission = 'denied'
    await expect(writeLocalTextFile(
      { handle: file, markdown: 'new' },
      { requestPermission: true },
    )).rejects.toThrow('Write permission is required')
    expect(file.contents).toBe('old')
  })

  it('renames by copying contents before removing the source', async () => {
    const root = new MemoryDirectory('project')
    root.entriesMap.set('before.md', new MemoryFile('before.md', '# Preserved'))
    const renamed = await renameLocalTextFile(root, 'before.md', 'docs/after.md')

    expect(root.entriesMap.has('before.md')).toBe(false)
    expect(renamed.name).toBe('after.md')
    expect(await (await renamed.getFile()).text()).toBe('# Preserved')
    const docs = root.entriesMap.get('docs') as MemoryDirectory
    expect(docs.entriesMap.get('after.md')).toBe(renamed)
  })

  it('refuses to overwrite an existing destination', async () => {
    const root = new MemoryDirectory('project')
    root.entriesMap.set('before.md', new MemoryFile('before.md', 'source'))
    root.entriesMap.set('after.md', new MemoryFile('after.md', 'destination'))
    await expect(renameLocalTextFile(root, 'before.md', 'after.md')).rejects.toThrow(
      'already exists',
    )
    expect((root.entriesMap.get('before.md') as MemoryFile).contents).toBe('source')
    expect((root.entriesMap.get('after.md') as MemoryFile).contents).toBe('destination')
  })

  it('rolls back the destination if removing the source fails', async () => {
    const root = new MemoryDirectory('project')
    root.entriesMap.set('before.md', new MemoryFile('before.md', 'source'))
    root.failRemoveFor.add('before.md')
    await expect(renameLocalTextFile(root, 'before.md', 'after.md')).rejects.toThrow(
      'remove failed',
    )
    expect(root.entriesMap.has('before.md')).toBe(true)
    expect(root.entriesMap.has('after.md')).toBe(false)
  })

  it('rejects paths that can escape the selected directory', async () => {
    const root = new MemoryDirectory('project')
    root.entriesMap.set('before.md', new MemoryFile('before.md', 'source'))
    await expect(renameLocalTextFile(root, 'before.md', '../after.md')).rejects.toThrow(
      'path is invalid',
    )
    expect(root.entriesMap.has('before.md')).toBe(true)
  })
})
