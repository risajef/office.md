import { describe, expect, it } from 'vitest'
import {
  createMemoryStyleFolderPort,
  type StyleFolderSnapshot,
} from '../../src/style-folder-port'

describe('StyleFolderPort', () => {
  const createPort = () => createMemoryStyleFolderPort({
    path: '/tmp/office-md-styles',
    name: 'office-md-styles',
    files: [
      { name: 'paper.css', contents: ':root { --paper: white; }' },
      { name: 'nested/dusk.css', contents: '.ProseMirror { color: white; }' },
      { name: 'nested/readme.txt', contents: 'ignored' },
      { name: '.hidden.css', contents: 'ignored' },
      { name: 'nested/.hidden.css', contents: 'ignored' },
    ],
  })

  it('selects one folder and returns visible CSS files with relative paths and source-qualified identities', async () => {
    const port = createPort()

    const selected = await port.open()

    expect(selected).toEqual<StyleFolderSnapshot>({
      folder: {
        id: 'memory:/tmp/office-md-styles',
        name: 'office-md-styles',
        path: '/tmp/office-md-styles',
      },
      files: [
        {
          id: 'style-folder:memory:/tmp/office-md-styles/nested/dusk.css',
          name: 'nested/dusk.css',
          contents: '.ProseMirror { color: white; }',
        },
        {
          id: 'style-folder:memory:/tmp/office-md-styles/paper.css',
          name: 'paper.css',
          contents: ':root { --paper: white; }',
        },
      ],
    })
    expect(await port.readFile('nested/dusk.css')).toBe(
      '.ProseMirror { color: white; }',
    )
  })

  it('reports an unreadable selected folder through the public port', async () => {
    const port = createMemoryStyleFolderPort({
      path: '/tmp/unreadable-styles',
      name: 'unreadable-styles',
      files: [],
      openError: 'The selected style folder cannot be read.',
    })

    await expect(port.open()).rejects.toThrow(
      'The selected style folder cannot be read',
    )
    expect(port.folder).toBeUndefined()
  })

  it('rejects absolute Windows paths as style-file names', async () => {
    const port = createMemoryStyleFolderPort({
      path: '/tmp/styles',
      name: 'styles',
      files: [{ name: 'theme.css', contents: 'theme' }],
    })
    await port.open()

    await expect(port.readFile('C:/outside.css')).rejects.toThrow('invalid')
  })
})
