import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const preload = readFileSync(path.resolve('electron/preload.ts'), 'utf8')
const main = readFileSync(path.resolve('electron/main.ts'), 'utf8')

describe('Electron update bridge contract', () => {
  it('uses fixed channels for status and user-controlled update commands', () => {
    expect(preload).toContain("state: 'update:state'")
    expect(preload).toContain("getState: 'update:get-state'")
    expect(preload).toContain("check: 'update:check'")
    expect(preload).toContain("download: 'update:download'")
    expect(preload).toContain("install: 'update:install'")
    expect(main).toContain('ELECTRON_UPDATE_CHANNELS.state')
    expect(main).toContain('ELECTRON_UPDATE_CHANNELS.check')
    expect(main).toContain('ELECTRON_UPDATE_CHANNELS.download')
    expect(main).toContain('ELECTRON_UPDATE_CHANNELS.install')
  })

  it('does not expose arbitrary update URLs, paths, or provider credentials', () => {
    expect(preload).not.toMatch(/setFeedURL|provider|auth.?token|filePath|downloadPath/)
    expect(main).not.toMatch(/setFeedURL\(|addAuthHeader\(|auth.?token/)
  })

  it('preserves the existing workspace and style-folder bridges alongside updates', () => {
    expect(preload).toContain('contextBridge.exposeInMainWorld(\'officeMd\', { workspace, styleFolder, updates })')
    expect(main).toContain('ELECTRON_WORKSPACE_CHANNELS.open')
    expect(main).toContain('ELECTRON_WORKSPACE_CHANNELS.deleteDirectory')
    expect(main).toContain('ELECTRON_STYLE_FOLDER_CHANNELS.open')
  })
})
