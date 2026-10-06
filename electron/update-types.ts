export type UpdatePlatform = 'linux' | 'win32'
export type UpdateArchitecture = 'x64'

export type UpdateRelease = {
  version: string
  tag: string
  platform: UpdatePlatform
  architecture: UpdateArchitecture
  releaseDate?: string
}

export type UpdateDownloadProgress = {
  percent: number
  transferredBytes?: number
  totalBytes?: number
  bytesPerSecond?: number
}

export type UpdatePickerView =
  | { status: 'checking' }
  | { status: 'selecting' }
  | { status: 'empty' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'installing'; version: string }
  | { status: 'error'; phase: 'lookup' | 'download'; message: string }

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export const parseStableVersion = (version: string) => {
  const match = version.match(stableVersionPattern)
  if (!match) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const
}

export const compareStableVersions = (left: string, right: string) => {
  const leftParts = parseStableVersion(left)
  const rightParts = parseStableVersion(right)
  if (!leftParts || !rightParts) {
    throw new Error('Only stable MAJOR.MINOR.PATCH versions are supported.')
  }
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index]
    if (difference !== 0) return difference
  }
  return 0
}
