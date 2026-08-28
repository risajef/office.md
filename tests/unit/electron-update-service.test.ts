import { describe, expect, it } from 'vitest'
import {
  createFakeUpdateProvider,
  type UpdateState,
} from '../../src/electron-update'
import { createElectronUpdateService } from '../../electron/update-service'

const release = {
  version: '1.1.0',
  platform: 'linux' as const,
  architecture: 'x64' as const,
}

const createService = (options: {
  isPackaged?: boolean
  environment?: NodeJS.ProcessEnv
  releases?: typeof release[]
} = {}) => {
  const fake = createFakeUpdateProvider({ releases: options.releases ?? [release] })
  const service = createElectronUpdateService({
    currentVersion: '1.0.0',
    platform: 'linux',
    architecture: 'x64',
    isPackaged: options.isPackaged ?? true,
    environment: options.environment ?? {},
    provider: fake.provider,
  })
  return { service, fake }
}

describe('Electron update service', () => {
  it('performs one non-blocking startup check and exposes the result', async () => {
    const { service, fake } = createService()
    const states: UpdateState[] = []
    service.subscribe((state) => states.push(state))

    await service.start()
    await service.start()

    expect(fake.calls.check).toBe(1)
    expect(states.map((state) => state.status)).toEqual(['checking', 'available'])
  })

  it('allows a user-invoked manual check after startup', async () => {
    const { service, fake } = createService({ releases: [] })

    await service.start()
    await service.check()

    expect(fake.calls.check).toBe(2)
    expect(service.getState()).toMatchObject({ status: 'up-to-date' })
  })

  it('keeps provider failures as observable retryable state instead of rejecting startup', async () => {
    const fake = createFakeUpdateProvider({ checkError: new Error('offline') })
    const service = createElectronUpdateService({
      currentVersion: '1.0.0',
      platform: 'linux',
      architecture: 'x64',
      isPackaged: true,
      environment: {},
      provider: fake.provider,
    })

    await expect(service.start()).resolves.toMatchObject({
      status: 'error',
      message: 'offline',
      retryable: true,
    })
  })

  it.each([
    ['unpackaged', false, {}],
    ['development server', true, { OFFICE_MD_DEV_SERVER_URL: 'http://127.0.0.1:4173' }],
    ['automated test workspace', true, { OFFICE_MD_TEST_WORKSPACE: '/tmp/test-workspace' }],
  ])('does not contact the provider in a %s session', async (_name, isPackaged, environment) => {
    const { service, fake } = createService({ isPackaged, environment })

    await service.start()
    await service.check()

    expect(fake.calls.check).toBe(0)
    expect(service.getState()).toEqual({ status: 'disabled' })
  })
})
