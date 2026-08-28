import type {
  AppUpdater,
  ProgressInfo,
  UpdateCheckResult,
  UpdateInfo,
} from 'electron-updater'
import type {
  UpdateArchitecture,
  UpdateDownloadProgress,
  UpdatePlatform,
  UpdateProvider,
  UpdateRelease,
} from '../src/electron-update'

export type ElectronUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  allowDowngrade: boolean
  checkForUpdates: AppUpdater['checkForUpdates']
  downloadUpdate: AppUpdater['downloadUpdate']
  quitAndInstall: AppUpdater['quitAndInstall']
  on: (
    event: 'download-progress',
    listener: (info: ProgressInfo) => void,
  ) => unknown
  removeListener: (
    event: 'download-progress',
    listener: (info: ProgressInfo) => void,
  ) => unknown
}

const platformLabel = (platform: UpdatePlatform) =>
  platform === 'win32' ? 'windows' : 'linux'

const expectedArtifactName = (
  version: string,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => `office.md-${version}-${platformLabel(platform)}-${architecture}.${platform === 'win32' ? 'exe' : 'AppImage'}`

const updateInfoHasExpectedArtifact = (
  info: UpdateInfo,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => {
  const expected = expectedArtifactName(info.version, platform, architecture)
  return info.files.some((file) => {
    try {
      const fileName = new URL(file.url, 'https://updates.invalid').pathname
        .split('/')
        .at(-1)
      return fileName === expected && Boolean(file.sha512)
    } catch {
      return false
    }
  })
}

const mapUpdate = (
  info: UpdateInfo,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
): UpdateRelease => {
  if (!updateInfoHasExpectedArtifact(info, platform, architecture)) {
    throw new Error(
      `Update ${info.version} has no matching ${platformLabel(platform)} ${architecture} package with an integrity hash.`,
    )
  }
  return {
    version: info.version,
    platform,
    architecture,
    releaseDate: info.releaseDate,
  }
}

export const createElectronUpdaterProvider = (
  updater: ElectronUpdaterLike,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
): UpdateProvider => {
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = false
  updater.allowDowngrade = false

  return {
    check: async () => {
      const result = await updater.checkForUpdates()
      if (!result || !result.isUpdateAvailable) return []
      return [mapUpdate(result.updateInfo, platform, architecture)]
    },
    download: async (_release, onProgress) => {
      const handleProgress = (progress: ProgressInfo) => {
        const value: UpdateDownloadProgress = {
          percent: progress.percent,
          transferredBytes: progress.transferred,
          totalBytes: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        }
        onProgress(value)
      }
      updater.on('download-progress', handleProgress)
      try {
        await updater.downloadUpdate()
      } finally {
        updater.removeListener('download-progress', handleProgress)
      }
    },
    install: async () => {
      updater.quitAndInstall(false, false)
    },
  }
}
