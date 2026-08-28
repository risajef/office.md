import type { ElectronUpdateApi } from './electron-api'
import type { UpdateState } from './electron-update'

export type UpdateNotificationElements = {
  notification: HTMLElement
  message: HTMLElement
  progress: HTMLProgressElement
  check: HTMLButtonElement
  download: HTMLButtonElement
  postpone: HTMLButtonElement
  retry: HTMLButtonElement
  install: HTMLButtonElement
}

const queryElements = (root: ParentNode): UpdateNotificationElements | undefined => {
  const notification = root.querySelector<HTMLElement>('#update-notification')
  const message = root.querySelector<HTMLElement>('#update-message')
  const progress = root.querySelector<HTMLProgressElement>('#update-progress')
  const check = root.querySelector<HTMLButtonElement>('#update-check')
  const download = root.querySelector<HTMLButtonElement>('#update-download')
  const postpone = root.querySelector<HTMLButtonElement>('#update-postpone')
  const retry = root.querySelector<HTMLButtonElement>('#update-retry')
  const install = root.querySelector<HTMLButtonElement>('#update-install')
  if (!notification || !message || !progress || !check || !download || !postpone || !retry || !install) {
    return undefined
  }
  return { notification, message, progress, check, download, postpone, retry, install }
}

const errorState = (error: unknown, phase: 'check' | 'download' | 'install'): UpdateState => ({
  status: 'error',
  message: error instanceof Error ? error.message : String(error),
  retryable: true,
  phase,
})

export const mountElectronUpdateUi = (
  api: ElectronUpdateApi,
  providedElements?: UpdateNotificationElements,
  root: ParentNode = document,
) => {
  const elements = providedElements ?? queryElements(root)
  if (!elements) return () => undefined

  const {
    notification,
    message,
    progress,
    check,
    download,
    postpone,
    retry,
    install,
  } = elements
  let receivedState = false

  const render = (state: UpdateState) => {
    receivedState = true
    notification.dataset.state = state.status
    notification.hidden = state.status === 'disabled'
    check.hidden = true
    download.hidden = true
    postpone.hidden = true
    retry.hidden = true
    install.hidden = true
    progress.hidden = true
    download.disabled = false
    postpone.disabled = false
    retry.disabled = false
    install.disabled = false

    switch (state.status) {
      case 'disabled':
        message.textContent = ''
        return
      case 'checking':
        message.textContent = 'Checking for updates…'
        return
      case 'up-to-date':
        message.textContent = `You are up to date (${state.currentVersion}).`
        check.hidden = false
        return
      case 'available':
        message.textContent = `Version ${state.version} is available.`
        check.hidden = false
        download.hidden = false
        postpone.hidden = false
        return
      case 'downloading':
        message.textContent = `Downloading version ${state.version}… ${Math.round(state.percent)}%`
        progress.hidden = false
        progress.value = state.percent
        download.disabled = true
        postpone.disabled = true
        return
      case 'downloaded':
        message.textContent = `Version ${state.version} is ready to install.`
        postpone.hidden = false
        install.hidden = false
        return
      case 'error':
        message.textContent = `Update failed: ${state.message}`
        retry.hidden = !state.retryable
        check.hidden = !state.retryable
    }
  }

  const runAction = async (
    action: () => Promise<UpdateState>,
    phase: 'check' | 'download' | 'install',
  ) => {
    try {
      render(await action())
    } catch (error) {
      render(errorState(error, phase))
    }
  }

  const onCheck = () => { void runAction(() => api.check(), 'check') }
  const onDownload = () => { void runAction(() => api.download(), 'download') }
  const onPostpone = () => { void runAction(() => api.postpone(), 'check') }
  const onRetry = () => { void runAction(() => api.check(), 'check') }
  const onInstall = () => { void runAction(() => api.install(), 'install') }
  check.addEventListener('click', onCheck)
  download.addEventListener('click', onDownload)
  postpone.addEventListener('click', onPostpone)
  retry.addEventListener('click', onRetry)
  install.addEventListener('click', onInstall)
  const unsubscribe = api.subscribe(render)
  void api.getState().then((state) => {
    if (!receivedState) render(state)
  }).catch((error) => render(errorState(error, 'check')))

  return () => {
    unsubscribe()
    check.removeEventListener('click', onCheck)
    download.removeEventListener('click', onDownload)
    postpone.removeEventListener('click', onPostpone)
    retry.removeEventListener('click', onRetry)
    install.removeEventListener('click', onInstall)
  }
}
