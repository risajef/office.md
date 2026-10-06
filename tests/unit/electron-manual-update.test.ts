import { describe, expect, it, vi } from 'vitest'
import {
  runManualUpdateFlow,
  type UpdatePickerSession,
} from '../../electron/manual-update-flow'
import type { UpdateRelease } from '../../electron/update-types'

const release = (version: string): UpdateRelease => ({
  version,
  platform: 'linux',
  architecture: 'x64',
  tag: `v${version}`,
})

const setup = (options: {
  releases?: readonly UpdateRelease[]
  selectedVersion?: string
  confirm?: boolean
  catalogError?: Error
  retry?: 'retry' | 'close'
} = {}) => {
  const views: unknown[] = []
  const waitForRetryOrClose = vi.fn(async () => options.retry ?? 'close')
  const session: UpdatePickerSession = {
    setView: (view) => views.push(view),
    chooseVersion: async () => options.selectedVersion,
    waitForRetryOrClose,
    close: vi.fn(),
  }
  const openPicker = vi.fn(() => session)
  const list = vi.fn(async () => {
    if (options.catalogError) throw options.catalogError
    return options.releases ?? []
  })
  const confirm = vi.fn(async () => options.confirm ?? true)
  const install = vi.fn(async (_release, onProgress, onInstalling) => {
    onProgress({ percent: 47 })
    onInstalling()
  })
  const showUnavailable = vi.fn(async () => undefined)

  return {
    dependencies: {
      enabled: true,
      currentVersion: '1.0.0',
      platform: 'linux' as const,
      architecture: 'x64' as const,
      catalog: { list },
      openPicker,
      confirm,
      updater: { install },
      showUnavailable,
    },
    views,
    session,
    waitForRetryOrClose,
    openPicker,
    list,
    confirm,
    install,
    showUnavailable,
  }
}

describe('user initiated Electron updates', () => {
  it('passes the exact selected older version through confirmation and installation', async () => {
    const test = setup({
      releases: [release('1.1.0'), release('0.9.0')],
      selectedVersion: '0.9.0',
    })

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('installed')

    expect(test.confirm).toHaveBeenCalledWith(release('0.9.0'), true)
    expect(test.install).toHaveBeenCalledWith(
      release('0.9.0'),
      expect.any(Function),
      expect.any(Function),
    )
    expect(test.views).toContainEqual({ status: 'downloading', version: '0.9.0', percent: 47 })
    expect(test.views).toContainEqual({ status: 'installing', version: '0.9.0' })
  })

  it('does not download or install when the user declines confirmation', async () => {
    const test = setup({
      releases: [release('1.1.0')],
      selectedVersion: '1.1.0',
      confirm: false,
    })

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('declined')

    expect(test.install).not.toHaveBeenCalled()
    expect(test.session.close).toHaveBeenCalledOnce()
  })

  it('reports lookup failures and offers a retry without installing', async () => {
    const test = setup({ catalogError: new Error('GitHub is unavailable') })

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('failed')

    expect(test.views).toContainEqual(expect.objectContaining({
      status: 'error',
      phase: 'lookup',
      message: 'GitHub is unavailable',
    }))
    expect(test.waitForRetryOrClose).toHaveBeenCalledOnce()
    expect(test.install).not.toHaveBeenCalled()
  })

  it('retries the selected release after a download failure', async () => {
    const test = setup({
      releases: [release('1.1.0')],
      selectedVersion: '1.1.0',
    })
    test.install.mockImplementationOnce(async () => { throw new Error('connection reset') })
    test.waitForRetryOrClose.mockResolvedValueOnce('retry')

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('installed')

    expect(test.confirm).toHaveBeenCalledOnce()
    expect(test.install).toHaveBeenCalledTimes(2)
    expect(test.views).toContainEqual(expect.objectContaining({
      status: 'error',
      phase: 'download',
      message: 'connection reset',
    }))
  })

  it('retries a failed release lookup when the picker requests it', async () => {
    const test = setup({
      releases: [],
    })
    test.waitForRetryOrClose.mockResolvedValueOnce('retry').mockResolvedValue('close')
    test.list.mockImplementationOnce(async () => { throw new Error('temporary network error') })
    test.list.mockImplementationOnce(async () => [])

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('no-releases')

    expect(test.list).toHaveBeenCalledTimes(2)
    expect(test.views).toContainEqual({ status: 'empty' })
  })

  it('reports an empty compatible version list without prompting or installing', async () => {
    const test = setup()

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('no-releases')

    expect(test.confirm).not.toHaveBeenCalled()
    expect(test.install).not.toHaveBeenCalled()
  })

  it('reports update unavailability in unpackaged or unsupported runtimes', async () => {
    const test = setup()
    test.dependencies.enabled = false

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('unavailable')

    expect(test.showUnavailable).toHaveBeenCalledOnce()
    expect(test.list).not.toHaveBeenCalled()
    expect(test.openPicker).not.toHaveBeenCalled()
  })

  it('rejects a version that was not offered by the release catalog', async () => {
    const test = setup({
      releases: [release('1.1.0')],
      selectedVersion: '99.0.0',
    })

    await expect(runManualUpdateFlow(test.dependencies)).resolves.toBe('cancelled')

    expect(test.confirm).not.toHaveBeenCalled()
    expect(test.install).not.toHaveBeenCalled()
  })
})
