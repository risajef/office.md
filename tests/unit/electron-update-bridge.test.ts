import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const editorPreload = readFileSync(path.resolve('electron/preload.ts'), 'utf8')
const pickerPreload = readFileSync(path.resolve('electron/update-picker-preload.ts'), 'utf8')
const main = readFileSync(path.resolve('electron/main.ts'), 'utf8')

describe('Electron update bridge contract', () => {
  it('keeps update commands out of the editor preload and exposes only the picker actions', () => {
    expect(editorPreload).not.toMatch(/update:|updates/)
    expect(pickerPreload).toContain("select: 'update-picker:select'")
    expect(pickerPreload).toContain("retry: 'update-picker:retry'")
    expect(pickerPreload).toContain("close: 'update-picker:close'")
    expect(pickerPreload).not.toMatch(/setFeedURL|provider|auth.?token|filePath|downloadPath/)
  })

  it('keeps GitHub release discovery and update operations in the main process', () => {
    expect(main).toContain('createGitHubReleaseCatalog')
    expect(main).toContain('runManualUpdateFlow')
    expect(main).toContain('createElectronUpdaterProvider')
    expect(main).toContain('createHelpMenuTemplate')
    expect(main).not.toContain('updateService.start()')
  })

  it('preserves workspace and style-folder bridges in the editor preload', () => {
    expect(editorPreload).toContain("contextBridge.exposeInMainWorld('officeMd', { workspace, styleFolder })")
    expect(main).toContain('ELECTRON_WORKSPACE_CHANNELS.open')
    expect(main).toContain('ELECTRON_WORKSPACE_CHANNELS.deleteDirectory')
    expect(main).toContain('ELECTRON_STYLE_FOLDER_CHANNELS.open')
  })
})
