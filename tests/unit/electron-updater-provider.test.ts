import { describe, expect, it, vi } from 'vitest'
import type {
  ProgressInfo,
  UpdateCheckResult,
} from 'electron-updater'
import {
  createElectronUpdaterProvider,
  type ElectronUpdaterLike,
} from '../../electron/updater-provider'
import type { UpdateRelease } from '../../electron/update-types'

class FakeUpdater implements ElectronUpdaterLike {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowPrerelease = true
  allowDowngrade = false
  readonly setFeedURL = vi.fn<ElectronUpdaterLike['setFeedURL']>()
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

const updateResult = (version = '0.9.0'): UpdateCheckResult => ({
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

const selectedRelease: UpdateRelease = {
  version: '0.9.0',
  tag: 'v0.9.0',
  platform: 'linux',
  architecture: 'x64',
}

describe('Electron updater provider adapter', () => {
  it('targets the selected tag and permits a verified downgrade', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockImplementation(async () => {
      expect(updater.allowDowngrade).toBe(true)
      return updateResult()
    })
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.allowDowngrade).toBe(false)

    await provider.install(selectedRelease, () => undefined, () => undefined)

    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://github.com/risajef/office.md/releases/download/v0.9.0/',
    })
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    expect(updater.downloadUpdate).toHaveBeenCalledOnce()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, false)
    expect(updater.allowDowngrade).toBe(false)
  })

  it('reports download progress and installation before restarting', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue(updateResult())
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')
    const progress = []
    const phases: string[] = []

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
    await provider.install(
      selectedRelease,
      (value) => progress.push(value),
      () => phases.push('installing'),
    )

    expect(progress).toEqual([{
      percent: 40,
      transferredBytes: 40,
      totalBytes: 100,
      bytesPerSecond: 20,
    }])
    expect(phases).toEqual(['installing'])
    expect(updater.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('rejects metadata that does not identify the exact selected version', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue(updateResult('1.1.0'))
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    await expect(provider.install(selectedRelease, () => undefined, () => undefined))
      .rejects.toThrow(/could not be verified/)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('rejects update metadata without the selected platform asset and hash', async () => {
    const updater = new FakeUpdater()
    updater.checkForUpdates.mockResolvedValue({
      ...updateResult(),
      updateInfo: {
        ...updateResult().updateInfo,
        files: [{
          url: 'office.md-0.9.0-linux-x64.AppImage',
          sha512: '',
        }],
      },
    })
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    await expect(provider.install(selectedRelease, () => undefined, () => undefined))
      .rejects.toThrow(/matching linux x64 package/)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('rejects unsafe release tags before configuring the updater', async () => {
    const updater = new FakeUpdater()
    const provider = createElectronUpdaterProvider(updater, 'linux', 'x64')

    await expect(provider.install(
      { ...selectedRelease, tag: 'v0.9.0/../latest' },
      () => undefined,
      () => undefined,
    )).rejects.toThrow(/tag is invalid/)

    expect(updater.setFeedURL).not.toHaveBeenCalled()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })
})
