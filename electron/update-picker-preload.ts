import { contextBridge, ipcRenderer } from 'electron'
import type { UpdatePickerView, UpdateRelease } from './update-types'

const channels = {
  view: 'update-picker:view',
  releases: 'update-picker:releases',
  select: 'update-picker:select',
  retry: 'update-picker:retry',
  close: 'update-picker:close',
} as const

const isView = (value: unknown): value is UpdatePickerView =>
  Boolean(value && typeof value === 'object' && 'status' in value)

const isReleaseList = (value: unknown): value is UpdateRelease[] =>
  Array.isArray(value) && value.every((release) =>
    Boolean(release && typeof release === 'object' &&
      'version' in release && 'tag' in release &&
      'platform' in release && 'architecture' in release))

contextBridge.exposeInMainWorld('officeMdUpdatePicker', {
  select: (version: string) => ipcRenderer.send(channels.select, version),
  retry: () => ipcRenderer.send(channels.retry),
  close: () => ipcRenderer.send(channels.close),
  onView: (listener: (view: UpdatePickerView) => void) => {
    const receive = (_event: unknown, value: unknown) => {
      if (isView(value)) listener(value)
    }
    ipcRenderer.on(channels.view, receive)
    return () => ipcRenderer.removeListener(channels.view, receive)
  },
  onReleases: (listener: (releases: UpdateRelease[]) => void) => {
    const receive = (_event: unknown, value: unknown) => {
      if (isReleaseList(value)) listener(value)
    }
    ipcRenderer.on(channels.releases, receive)
    return () => ipcRenderer.removeListener(channels.releases, receive)
  },
})
