import { describe, expect, it, vi } from 'vitest'
import type {
  ProgressInfo,
  UpdateCheckResult,
} from 'electron-updater'
import {
  createElectronUpdaterProvider,
  type ElectronUpdaterLike,
} from '../../electron/updater-provider'

class FakeUpdater implements ElectronUpdaterLike {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowPrerelease = true
  allowDowngrade = true
  readonly checkForUpdates = vi.fn<() => Promise<UpdateCheckResult | null>>()
  readonly downloadUpdate = vi.fn(async () => [])
  readonly quitAndInstall = vi.fn()
  private readonly listeners = new Map<string, Set<(value: never) => void>>()

  on(event: string, listener: (value: never) => void) {
    const listeners = this.listeners.get(event) ?? new Set<(value: never) => void>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
    return this
  }

  removeListener(event: string, listener: (value: never) => void) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emitProgress(progress: ProgressInfo) {
    for (const listener of this.listeners.get('download-progress') ?? []) {
      listener(progress as never)
    }
  }
}

const updateResult = (version = '1.1.0'): UpdateCheckResult => ({
  isUpdateAvailable: true,
  updateInfo: {
    version,
    releaseDate: '2026-08-28T00:00:00.000Z',
    files: [{
      url: `office.md-${version}-linux-x64.AppImage`,
      sha512: 'known-good-hash',
    }],
    path: `office.md-${version}-linux-x64.AppImage`,
    sha512: 'known-good-hash',
  },
  versionInfo: undefined as never,
})

describe('electron-updater provider adapter', () => {
  it('disables automatic download/install and maps a verified update', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue(updateResult())
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    await expect(provider.check()).resolves.toEqual([{
      version: '1.1.0',
      platform: 'linux',
      architecture: 'x64',
      releaseDate: '2026-08-28T00:00:00.000Z',
    }])
  })

  it('translates download progress and controlled installation', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue(updateResult())
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')
    const progress = []
    const updates = await provider.check()

    updater.downloadUpdate.mockImplementation(async () => {
      updater.emitProgress({
        total: 100,
        delta: 40,
        transferred: 40,
        percent: 40,
        bytesPerSecond: 20,
      })
      return []
    })
    await provider.download(updates[0], (value) => progress.push(value))
    await provider.install()

    expect(progress).toEqual([{
      percent: 40,
      transferredBytes: 40,
      totalBytes: 100,
      bytesPerSecond: 20,
    }])
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, false)
  })

  it('rejects update metadata without the matching platform asset and hash', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue({
      ...updateResult(),
      updateInfo: {
        ...updateResult().updateInfo,
        files: [{
          url: 'office.md-1.1.0-linux-x64.AppImage',
          sha512: '',
        }],
      },
    })
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    await expect(provider.check()).rejects.toThrow(/matching linux x64 package/)
  })
})
