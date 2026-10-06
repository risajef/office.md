import type {
  AppUpdater,
  ProgressInfo,
  UpdateInfo,
} from 'electron-updater'
import type {
  UpdateArchitecture,
  UpdateDownloadProgress,
  UpdatePlatform,
  UpdateRelease,
} from './update-types'

export type ElectronUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  allowDowngrade: boolean
  setFeedURL: AppUpdater['setFeedURL']
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

const ensureValidRelease = (release: UpdateRelease) => {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag) ||
    release.tag !== `v${release.version}`) {
    throw new Error('The selected update release tag is invalid.')
  }
}

export const createElectronUpdaterProvider = (
  updater: ElectronUpdaterLike,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => {
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = false

  return {
    install: async (
      release: UpdateRelease,
      onProgress: (progress: UpdateDownloadProgress) => void,
      onInstalling: () => void,
    ) => {
      ensureValidRelease(release)
      if (release.platform !== platform || release.architecture !== architecture) {
        throw new Error('The selected update release is incompatible with this application.')
      }

      const previousAllowDowngrade = updater.allowDowngrade
      updater.allowDowngrade = true
      try {
        updater.setFeedURL({
          provider: 'generic',
          url: `https://github.com/risajef/office.md/releases/download/${release.tag}/`,
        })
        const result = await updater.checkForUpdates()
        if (!result || result.updateInfo.version !== release.version) {
          throw new Error(`Release ${release.version} could not be verified for installation.`)
        }
        if (!updateInfoHasExpectedArtifact(result.updateInfo, platform, architecture)) {
          throw new Error(
            `Update ${release.version} has no matching ${platformLabel(platform)} ${architecture} package with an integrity hash.`,
          )
        }
        if (!result.isUpdateAvailable) {
          throw new Error(`Release ${release.version} is not available for installation.`)
        }

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
        onInstalling()
        updater.quitAndInstall(false, false)
      } finally {
        updater.allowDowngrade = previousAllowDowngrade
      }
    },
  }
}
