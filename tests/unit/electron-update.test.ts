import { describe, expect, it } from 'vitest'
import {
  createFakeUpdateProvider,
  createUpdateController,
  type UpdateState,
} from '../../src/electron-update'

const linuxRelease = (version: string) => ({
  version,
  platform: 'linux' as const,
  architecture: 'x64' as const,
})

const createController = (options: Parameters<typeof createFakeUpdateProvider>[0] = {}) => {
  const fake = createFakeUpdateProvider(options)
  const controller = createUpdateController({
    currentVersion: '1.0.0',
    platform: 'linux',
    architecture: 'x64',
    enabled: true,
    provider: fake.provider,
  })
  return { controller, fake }
}

describe('Electron update controller', () => {
  it('stays disabled and does not contact the provider when updates are disabled', async () => {
    const fake = createFakeUpdateProvider({ releases: [linuxRelease('2.0.0')] })
    const controller = createUpdateController({
      currentVersion: '1.0.0',
      platform: 'linux',
      architecture: 'x64',
      enabled: false,
      provider: fake.provider,
    })

    expect(controller.getState()).toEqual({ status: 'disabled' })
    await controller.check()
    expect(controller.getState()).toEqual({ status: 'disabled' })
    expect(fake.calls.check).toBe(0)
  })

  it('reports checking and an available compatible stable release', async () => {
    const { controller } = createController({
      releases: [linuxRelease('1.1.0')],
    })
    const states: UpdateState[] = []
    controller.subscribe((state) => states.push(state))

    await controller.check()

    expect(states.map((state) => state.status)).toEqual(['checking', 'available'])
    expect(controller.getState()).toMatchObject({
      status: 'available',
      version: '1.1.0',
    })
  })

  it('reports up to date when no newer compatible stable release exists', async () => {
    const { controller } = createController({
      releases: [
        linuxRelease('0.9.0'),
        linuxRelease('1.0.0'),
        { ...linuxRelease('2.0.0'), prerelease: true },
        { ...linuxRelease('2.1.0'), platform: 'win32' as const },
      ],
    })

    await controller.check()

    expect(controller.getState()).toEqual({
      status: 'up-to-date',
      currentVersion: '1.0.0',
    })
  })

  it('selects the newest compatible release', async () => {
    const { controller } = createController({
      releases: [linuxRelease('1.1.0'), linuxRelease('1.3.0'), linuxRelease('1.2.0')],
    })

    await controller.check()

    expect(controller.getState()).toMatchObject({
      status: 'available',
      version: '1.3.0',
    })
  })

  it('reports download progress and the downloaded state', async () => {
    const { controller } = createController({
      releases: [linuxRelease('1.1.0')],
      downloadProgress: [12, 67, 100],
    })
    const states: UpdateState[] = []
    controller.subscribe((state) => states.push(state))

    await controller.check()
    await controller.download()

    expect(states.map((state) => state.status)).toEqual([
      'checking',
      'available',
      'downloading',
      'downloading',
      'downloading',
      'downloading',
      'downloaded',
    ])
    expect(states.filter((state) => state.status === 'downloading').map((state) => (
      state.status === 'downloading' ? state.percent : -1
    ))).toEqual([0, 12, 67, 100])
    expect(controller.getState()).toMatchObject({
      status: 'downloaded',
      version: '1.1.0',
    })
  })

  it('reports retryable errors when checking or downloading is interrupted', async () => {
    const checkFailure = createController({
      checkError: new Error('network unavailable'),
    })
    await checkFailure.controller.check()
    expect(checkFailure.controller.getState()).toMatchObject({
      status: 'error',
      retryable: true,
      message: 'network unavailable',
    })

    const downloadFailure = createController({
      releases: [linuxRelease('1.1.0')],
      downloadError: new Error('download interrupted'),
    })
    await downloadFailure.controller.check()
    await downloadFailure.controller.download()
    expect(downloadFailure.controller.getState()).toMatchObject({
      status: 'error',
      retryable: true,
      message: 'download interrupted',
    })
  })

  it('allows subscribers to stop receiving state changes', async () => {
    const { controller } = createController({ releases: [linuxRelease('1.1.0')] })
    const states: UpdateState[] = []
    const unsubscribe = controller.subscribe((state) => states.push(state))
    unsubscribe()

    await controller.check()

    expect(states).toEqual([])
  })

  it('postpones an available update without downloading or installing it', async () => {
    const { controller, fake } = createController({
      releases: [linuxRelease('1.1.0')],
    })
    await controller.check()

    expect(controller.postpone()).toMatchObject({
      status: 'available',
      version: '1.1.0',
    })
    expect(fake.calls.download).toBe(0)
    expect(fake.calls.install).toBe(0)
  })

  it('installs only after the user downloads an available update', async () => {
    const { controller, fake } = createController({
      releases: [linuxRelease('1.1.0')],
    })
    await controller.check()

    await controller.install()
    expect(fake.calls.install).toBe(0)

    await controller.download()
    expect(controller.getState()).toMatchObject({ status: 'downloaded' })
    await controller.install()
    expect(fake.calls.install).toBe(1)
  })
})
