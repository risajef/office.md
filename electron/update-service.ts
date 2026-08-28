import {
  createUpdateController,
  type UpdateArchitecture,
  type UpdateController,
  type UpdatePlatform,
  type UpdateProvider,
  type UpdateState,
} from '../src/electron-update'

export type ElectronUpdateService = UpdateController & {
  start: () => Promise<UpdateState>
}

export type ElectronUpdateServiceOptions = {
  currentVersion: string
  platform: UpdatePlatform
  architecture: UpdateArchitecture
  isPackaged: boolean
  environment: NodeJS.ProcessEnv
  provider: UpdateProvider
  allowTestUpdates?: boolean
}

const hasValue = (value: string | undefined) => Boolean(value && value !== '0')

export const isUpdateSessionEnabled = ({
  isPackaged,
  environment,
  allowTestUpdates = false,
}: Pick<
  ElectronUpdateServiceOptions,
  'isPackaged' | 'environment' | 'allowTestUpdates'
>) => {
  if (hasValue(environment.OFFICE_MD_DISABLE_UPDATES)) return false
  if (allowTestUpdates) return true
  if (!isPackaged) return false
  if (hasValue(environment.OFFICE_MD_DEV_SERVER_URL)) return false
  if (hasValue(environment.OFFICE_MD_TEST_WORKSPACE)) return false
  if (hasValue(environment.OFFICE_MD_TEST_MODE)) return false
  if (environment.NODE_ENV === 'test') return false
  return true
}

export const createElectronUpdateService = (
  options: ElectronUpdateServiceOptions,
): ElectronUpdateService => {
  const controller = createUpdateController({
    currentVersion: options.currentVersion,
    platform: options.platform,
    architecture: options.architecture,
    enabled: isUpdateSessionEnabled(options),
    provider: options.provider,
  })
  let started = false

  return {
    ...controller,
    start: () => {
      if (started) return Promise.resolve(controller.getState())
      started = true
      return controller.check()
    },
  }
}
