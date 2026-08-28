import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mountElectronUpdateUi,
  type UpdateNotificationElements,
} from '../../src/electron-update-ui'
import type { ElectronUpdateApi } from '../../src/electron-api'
import type { UpdateState } from '../../src/electron-update'

const createApi = () => {
  let state: UpdateState = { status: 'disabled' }
  const listeners = new Set<(next: UpdateState) => void>()
  const api: ElectronUpdateApi = {
    getState: vi.fn(async () => state),
    check: vi.fn(async () => state),
    download: vi.fn(async () => state),
    install: vi.fn(async () => state),
    postpone: vi.fn(async () => state),
    subscribe: vi.fn((listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  }
  return {
    api,
    emit: (next: UpdateState) => {
      state = next
      for (const listener of listeners) listener(next)
    },
  }
}

const createElements = (): UpdateNotificationElements => {
  document.body.innerHTML = `
    <section id="update-notification" hidden>
      <p id="update-message"></p>
      <progress id="update-progress" max="100" value="0"></progress>
      <button id="update-check" type="button">Check for updates</button>
      <button id="update-download" type="button">Download update</button>
      <button id="update-postpone" type="button">Later</button>
      <button id="update-retry" type="button">Retry</button>
      <button id="update-install" type="button">Restart to install</button>
    </section>
    <main id="editor">The editor remains available.</main>
  `
  return {
    notification: document.querySelector('#update-notification') as HTMLElement,
    message: document.querySelector('#update-message') as HTMLElement,
    progress: document.querySelector('#update-progress') as HTMLProgressElement,
    check: document.querySelector('#update-check') as HTMLButtonElement,
    download: document.querySelector('#update-download') as HTMLButtonElement,
    postpone: document.querySelector('#update-postpone') as HTMLButtonElement,
    retry: document.querySelector('#update-retry') as HTMLButtonElement,
    install: document.querySelector('#update-install') as HTMLButtonElement,
  }
}

describe('Electron update notification', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('shows an available version with download and postpone actions', async () => {
    const elements = createElements()
    const { api, emit } = createApi()
    const destroy = mountElectronUpdateUi(api, elements)
    emit({ status: 'available', version: '1.1.0' })

    expect(elements.notification.hidden).toBe(false)
    expect(elements.message.textContent).toContain('1.1.0')
    expect(elements.download.hidden).toBe(false)
    expect(elements.postpone.hidden).toBe(false)
    expect(document.querySelector('#editor')?.textContent).toContain('available')
    destroy()
  })

  it('renders progress, ready-to-install, and retryable error states', async () => {
    const elements = createElements()
    const { api, emit } = createApi()
    mountElectronUpdateUi(api, elements)

    emit({ status: 'downloading', version: '1.1.0', percent: 42 })
    expect(elements.message.textContent).toContain('42%')
    expect(elements.progress.value).toBe(42)
    expect(elements.download.disabled).toBe(true)

    emit({ status: 'downloaded', version: '1.1.0' })
    expect(elements.message.textContent).toContain('ready')
    expect(elements.install.hidden).toBe(false)
    expect(elements.postpone.hidden).toBe(false)

    emit({
      status: 'error',
      message: 'offline',
      retryable: true,
      phase: 'check',
    })
    expect(elements.message.textContent).toContain('offline')
    expect(elements.retry.hidden).toBe(false)
  })

  it('requires explicit actions and keeps postponement non-destructive', async () => {
    const elements = createElements()
    const { api, emit } = createApi()
    mountElectronUpdateUi(api, elements)
    emit({ status: 'available', version: '1.1.0' })

    elements.postpone.click()
    expect(api.download).not.toHaveBeenCalled()
    expect(api.install).not.toHaveBeenCalled()

    elements.download.click()
    await Promise.resolve()
    expect(api.download).toHaveBeenCalledOnce()

    emit({ status: 'error', message: 'offline', retryable: true, phase: 'check' })
    elements.retry.click()
    await Promise.resolve()
    expect(api.check).toHaveBeenCalledOnce()
  })

  it('exposes a manual check action when the desktop session is up to date', async () => {
    const elements = createElements()
    const { api, emit } = createApi()
    mountElectronUpdateUi(api, elements)

    emit({ status: 'up-to-date', currentVersion: '1.0.0' })
    expect(elements.check.hidden).toBe(false)
    elements.check.click()
    await Promise.resolve()
    expect(api.check).toHaveBeenCalledOnce()
  })
})
