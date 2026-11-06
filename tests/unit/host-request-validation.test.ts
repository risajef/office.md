import { describe, expect, it } from 'vitest'
import { createElectronStyleFolderService } from '../../electron/style-folder-service'
import { optionalRequestPath, parseShareArchiveSave, parseWorkspaceRequest } from '../../node/request-validation'

describe('host request validation', () => {
  it.each([null, [], { operation: 'readFile', folderId: 'styles', name: false }, { operation: 'reload', folderId: 12 }])('rejects malformed style requests: %j', async (input) => {
    await expect(createElectronStyleFolderService().dispatch(input as never)).rejects.toThrow('Invalid request')
  })
  it('accepts valid optional paths and rejects non-string hints', () => {
    expect(optionalRequestPath(undefined)).toBeUndefined()
    expect(optionalRequestPath('/workspace')).toBe('/workspace')
    expect(() => optionalRequestPath(12)).toThrow('Invalid request')
  })
  it('bounds archive filenames and bytes before showing a save dialog', () => {
    const bytes = new Uint8Array([1])
    expect(parseShareArchiveSave({ bytes, suggestedName: 'share.zip' })).toEqual({ bytes, suggestedName: 'share.zip' })
    for (const suggestedName of ['../share.zip', '/tmp/share.zip', '.hidden.zip', 'C:\\share.zip', 'share.md']) {
      expect(() => parseShareArchiveSave({ bytes, suggestedName })).toThrow('Invalid request')
    }
    expect(() => parseShareArchiveSave({ bytes: [1], suggestedName: 'share.zip' })).toThrow('Invalid request')
    expect(() => parseShareArchiveSave({ bytes: new Uint8Array(50 * 1024 * 1024 + 1), suggestedName: 'share.zip' })).toThrow('50 MiB')
  })
  it('preserves compatible reload defaults and rejects malformed image bytes', () => {
    expect(parseWorkspaceRequest({ operation: 'reload', workspaceId: 'session' })).toEqual({ operation: 'reload', workspaceId: 'session', refreshOnly: undefined })
    expect(() => parseWorkspaceRequest({ operation: 'saveImageAsset', workspaceId: 'session', directory: '', suggestedName: 'image.png', bytes: [1] })).toThrow('Invalid request')
  })
})
