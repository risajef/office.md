import {
  compareStableVersions,
  type UpdateDownloadProgress,
  type UpdatePickerView,
  type UpdateRelease,
} from './update-types'

export type UpdatePickerSession = {
  setView: (view: UpdatePickerView) => void
  chooseVersion: (releases: readonly UpdateRelease[]) => Promise<string | undefined>
  waitForRetryOrClose: () => Promise<'retry' | 'close'>
  close: () => void
}

export type ManualUpdateOutcome =
  | 'unavailable'
  | 'no-releases'
  | 'cancelled'
  | 'declined'
  | 'installed'
  | 'failed'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export type ManualUpdateFlowOptions = {
  enabled: boolean
  currentVersion: string
  platform: UpdateRelease['platform']
  architecture: UpdateRelease['architecture']
  catalog: {
    list: (
      currentVersion: string,
      platform: UpdateRelease['platform'],
      architecture: UpdateRelease['architecture'],
    ) => Promise<readonly UpdateRelease[]>
  }
  openPicker: () => UpdatePickerSession
  confirm: (release: UpdateRelease, isDowngrade: boolean) => Promise<boolean>
  updater: {
    install: (
      release: UpdateRelease,
      onProgress: (progress: UpdateDownloadProgress) => void,
      onInstalling: () => void,
    ) => Promise<void>
  }
  showUnavailable: () => Promise<void>
}

export const runManualUpdateFlow = async (
  options: ManualUpdateFlowOptions,
): Promise<ManualUpdateOutcome> => {
  if (!options.enabled) {
    await options.showUnavailable()
    return 'unavailable'
  }

  const picker = options.openPicker()
  try {
    while (true) {
      picker.setView({ status: 'checking' })
      let releases: readonly UpdateRelease[]
      try {
        releases = await options.catalog.list(
          options.currentVersion,
          options.platform,
          options.architecture,
        )
      } catch (error) {
        picker.setView({
          status: 'error',
          phase: 'lookup',
          message: errorMessage(error),
        })
        if (await picker.waitForRetryOrClose() === 'retry') continue
        return 'failed'
      }

      if (releases.length === 0) {
        picker.setView({ status: 'empty' })
        if (await picker.waitForRetryOrClose() === 'retry') continue
        return 'no-releases'
      }

      const selectedVersion = await picker.chooseVersion(releases)
      if (!selectedVersion) return 'cancelled'
      const selectedRelease = releases.find((release) => release.version === selectedVersion)
      if (!selectedRelease) return 'cancelled'

      const isDowngrade = compareStableVersions(selectedVersion, options.currentVersion) < 0
      if (!await options.confirm(selectedRelease, isDowngrade)) {
        return 'declined'
      }

      while (true) {
        picker.setView({ status: 'downloading', version: selectedVersion, percent: 0 })
        try {
          await options.updater.install(
            selectedRelease,
            (progress) => picker.setView({
              status: 'downloading',
              version: selectedVersion,
              percent: Number.isFinite(progress.percent)
                ? Math.min(100, Math.max(0, progress.percent))
                : 0,
            }),
            () => picker.setView({ status: 'installing', version: selectedVersion }),
          )
          return 'installed'
        } catch (error) {
          picker.setView({
            status: 'error',
            phase: 'download',
            message: errorMessage(error),
          })
          if (await picker.waitForRetryOrClose() !== 'retry') return 'failed'
        }
      }
    }
  } finally {
    picker.close()
  }
}
