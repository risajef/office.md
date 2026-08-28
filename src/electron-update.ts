export const UPDATE_PLATFORMS = ['linux', 'win32'] as const
export type UpdatePlatform = typeof UPDATE_PLATFORMS[number]

export const UPDATE_ARCHITECTURES = ['x64'] as const
export type UpdateArchitecture = typeof UPDATE_ARCHITECTURES[number]

export type UpdateRelease = {
  version: string
  platform: UpdatePlatform
  architecture: UpdateArchitecture
  prerelease?: boolean
  stable?: boolean
  releaseDate?: string
}

export type UpdateDownloadProgress = {
  percent: number
  transferredBytes?: number
  totalBytes?: number
  bytesPerSecond?: number
}

export type UpdateState =
  | { status: 'disabled' }
  | { status: 'checking' }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; version: string; releaseDate?: string }
  | ({ status: 'downloading'; version: string } & UpdateDownloadProgress)
  | { status: 'downloaded'; version: string }
  | {
      status: 'error'
      message: string
      retryable: boolean
      phase: 'check' | 'download' | 'install'
    }

export type UpdateProvider = {
  check: () => Promise<readonly UpdateRelease[]>
  download: (
    release: UpdateRelease,
    onProgress: (progress: UpdateDownloadProgress) => void,
  ) => Promise<void>
  install: () => Promise<void>
}

export type UpdateController = {
  getState: () => UpdateState
  subscribe: (listener: (state: UpdateState) => void) => () => void
  check: () => Promise<UpdateState>
  download: () => Promise<UpdateState>
  install: () => Promise<UpdateState>
  postpone: () => UpdateState
}

export type UpdateControllerOptions = {
  currentVersion: string
  platform: UpdatePlatform
  architecture: UpdateArchitecture
  enabled: boolean
  provider: UpdateProvider
}

type ParsedVersion = {
  major: number
  minor: number
  patch: number
}

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

const parseStableVersion = (value: unknown): ParsedVersion | undefined => {
  if (typeof value !== 'string') return undefined
  const match = value.match(stableVersionPattern)
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

const compareVersions = (left: ParsedVersion, right: ParsedVersion) => {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

const isCompatibleStableRelease = (
  release: UpdateRelease,
  current: ParsedVersion,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
) => {
  const version = parseStableVersion(release.version)
  if (!version || compareVersions(version, current) <= 0) return false
  if (release.prerelease === true || release.stable === false) return false
  return release.platform === platform && release.architecture === architecture
}

export const selectCompatibleUpdate = (
  releases: readonly UpdateRelease[],
  currentVersion: string,
  platform: UpdatePlatform,
  architecture: UpdateArchitecture,
): UpdateRelease | undefined => {
  const current = parseStableVersion(currentVersion)
  if (!current) throw new Error(`The current application version is invalid: ${currentVersion}`)

  return releases
    .filter((release) => isCompatibleStableRelease(
      release,
      current,
      platform,
      architecture,
    ))
    .sort((left, right) => {
      const leftVersion = parseStableVersion(left.version)
      const rightVersion = parseStableVersion(right.version)
      if (!leftVersion || !rightVersion) return 0
      return compareVersions(rightVersion, leftVersion)
    })[0]
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const clampPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0

export const createUpdateController = (
  options: UpdateControllerOptions,
): UpdateController => {
  const subscribers = new Set<(state: UpdateState) => void>()
  const currentVersion = options.currentVersion
  let state: UpdateState = options.enabled
    ? { status: 'up-to-date', currentVersion }
    : { status: 'disabled' }
  let candidate: UpdateRelease | undefined
  let operation: Promise<UpdateState> | undefined

  const getState = () => state

  const setState = (next: UpdateState) => {
    state = next
    for (const subscriber of subscribers) subscriber(next)
    return next
  }

  const subscribe = (listener: (next: UpdateState) => void) => {
    subscribers.add(listener)
    return () => subscribers.delete(listener)
  }

  const track = (work: () => Promise<UpdateState>) => {
    const task = work()
    operation = task
    void task.finally(() => {
      if (operation === task) operation = undefined
    }).catch(() => undefined)
    return task
  }

  const check = (): Promise<UpdateState> => {
    if (!options.enabled) return Promise.resolve(state)
    if (operation) return operation
    return track(async () => {
      setState({ status: 'checking' })
      try {
        const releases = await options.provider.check()
        candidate = selectCompatibleUpdate(
          releases,
          currentVersion,
          options.platform,
          options.architecture,
        )
        return candidate
          ? setState({
              status: 'available',
              version: candidate.version,
              releaseDate: candidate.releaseDate,
            })
          : setState({ status: 'up-to-date', currentVersion })
      } catch (error) {
        candidate = undefined
        return setState({
          status: 'error',
          message: errorMessage(error),
          retryable: true,
          phase: 'check',
        })
      }
    })
  }

  const download = (): Promise<UpdateState> => {
    if (!options.enabled || operation || state.status !== 'available' || !candidate) {
      return operation ?? Promise.resolve(state)
    }
    const release = candidate
    return track(async () => {
      setState({
        status: 'downloading',
        version: release.version,
        percent: 0,
      })
      try {
        await options.provider.download(release, (progress) => {
          setState({
            status: 'downloading',
            version: release.version,
            percent: clampPercent(progress.percent),
            ...(typeof progress.transferredBytes === 'number'
              ? { transferredBytes: progress.transferredBytes }
              : {}),
            ...(typeof progress.totalBytes === 'number'
              ? { totalBytes: progress.totalBytes }
              : {}),
            ...(typeof progress.bytesPerSecond === 'number'
              ? { bytesPerSecond: progress.bytesPerSecond }
              : {}),
          })
        })
        return setState({ status: 'downloaded', version: release.version })
      } catch (error) {
        return setState({
          status: 'error',
          message: errorMessage(error),
          retryable: true,
          phase: 'download',
        })
      }
    })
  }

  const install = (): Promise<UpdateState> => {
    if (!options.enabled || operation || state.status !== 'downloaded') {
      return operation ?? Promise.resolve(state)
    }
    return track(async () => {
      try {
        await options.provider.install()
      } catch (error) {
        return setState({
          status: 'error',
          message: errorMessage(error),
          retryable: true,
          phase: 'install',
        })
      }
      return state
    })
  }

  return {
    getState,
    subscribe,
    check,
    download,
    install,
    postpone: () => state,
  }
}

export type FakeUpdateProviderOptions = {
  releases?: readonly UpdateRelease[]
  downloadProgress?: readonly number[]
  checkError?: unknown
  downloadError?: unknown
  installError?: unknown
}

export const createFakeUpdateProvider = (
  options: FakeUpdateProviderOptions = {},
) => {
  const calls = {
    check: 0,
    download: 0,
    install: 0,
  }
  const provider: UpdateProvider = {
    check: async () => {
      calls.check += 1
      if (options.checkError !== undefined) throw options.checkError
      return options.releases ?? []
    },
    download: async (_release, onProgress) => {
      calls.download += 1
      if (options.downloadError !== undefined) throw options.downloadError
      for (const percent of options.downloadProgress ?? []) {
        onProgress({ percent })
      }
    },
    install: async () => {
      calls.install += 1
      if (options.installError !== undefined) throw options.installError
    },
  }
  return { provider, calls }
}
