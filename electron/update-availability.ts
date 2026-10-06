export type UpdateAvailabilityOptions = {
  isPackaged: boolean
  environment: NodeJS.ProcessEnv
}

export const isSupportedUpdateTarget = (platform: string, architecture: string) =>
  (platform === 'linux' || platform === 'win32') && architecture === 'x64'

const hasValue = (value: string | undefined) => Boolean(value && value !== '0')

export const isManualUpdateEnabled = ({
  isPackaged,
  environment,
}: UpdateAvailabilityOptions) => {
  if (hasValue(environment.OFFICE_MD_DISABLE_UPDATES)) return false
  if (!isPackaged) return false
  if (hasValue(environment.OFFICE_MD_DEV_SERVER_URL)) return false
  if (hasValue(environment.OFFICE_MD_TEST_WORKSPACE)) return false
  if (hasValue(environment.OFFICE_MD_TEST_MODE)) return false
  if (environment.NODE_ENV === 'test') return false
  return true
}

export const getManualUpdateUnavailableReason = (options: UpdateAvailabilityOptions & {
  isSupportedTarget: boolean
}) => {
  if (!options.isSupportedTarget) {
    return 'Updates are available for packaged x64 Linux AppImage and Windows releases.'
  }
  if (!options.isPackaged) {
    return 'Linux x64 updates are supported from an installed AppImage. This development run is not a packaged installation.'
  }
  if (
    hasValue(options.environment.OFFICE_MD_DISABLE_UPDATES) ||
    hasValue(options.environment.OFFICE_MD_DEV_SERVER_URL) ||
    hasValue(options.environment.OFFICE_MD_TEST_WORKSPACE) ||
    hasValue(options.environment.OFFICE_MD_TEST_MODE) ||
    options.environment.NODE_ENV === 'test'
  ) {
    return 'Update checks are disabled for this development or test session.'
  }
  return 'Updates are unavailable for this installation.'
}
