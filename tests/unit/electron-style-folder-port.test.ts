import { describe, expect, it, vi } from 'vitest'
import { createElectronStyleFolderPort } from '../../src/electron-style-folder-port'
import type { ElectronStyleFolderApi } from '../../src/electron-api'
import type { StyleFolderSnapshot } from '../../src/style-folder-port'

const snapshot = (name = 'desktop-styles'): StyleFolderSnapshot => ({
  folder: {
    id: 'desktop-style-folder-id',
    name,
    path: `/tmp/${name}`,
  },
  files: [{ id: '', name: 'theme.css', contents: 'theme' }],
})

const createApi = (): ElectronStyleFolderApi => ({
  open: vi.fn(async () => snapshot()),
  restore: vi.fn(async () => snapshot()),
  reload: vi.fn(async () => snapshot('reloaded-styles')),
  readFile: vi.fn(async () => 'theme'),
})

describe('Electron style-folder port', () => {
  it('translates the secure preload API into the shared style-folder contract', async () => {
    const api = createApi()
    const port = createElectronStyleFolderPort(api)

    const opened = await port.open()

    expect(opened?.folder.name).toBe('desktop-styles')
    expect(port.folder?.id).toBe('desktop-style-folder-id')
    expect(await port.readFile('theme.css')).toBe('theme')
    expect(await port.reload()).toEqual(expect.objectContaining({
      folder: expect.objectContaining({ name: 'reloaded-styles' }),
    }))
    expect(api.readFile).toHaveBeenCalledWith('desktop-style-folder-id', 'theme.css')
    expect(api.reload).toHaveBeenCalledWith('desktop-style-folder-id')
  })

  it('reports an unavailable preload bridge without falling back to web access', async () => {
    const port = createElectronStyleFolderPort(undefined)

    await expect(port.open()).rejects.toThrow('No supported style-folder access')
  })
})
