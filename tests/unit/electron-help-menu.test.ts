import { describe, expect, it, vi } from 'vitest'
import {
  createInfoAction,
  OFFICE_MD_REPOSITORY_URL,
} from '../../electron/help-info'
import { createHelpMenuTemplate } from '../../electron/help-menu'

describe('Electron Help menu', () => {
  it('shows the installed version and repository link, and opens the fixed repository URL', async () => {
    const showMessageBox = vi.fn(async () => ({ response: 0 }))
    const openExternal = vi.fn(async () => undefined)
    const info = createInfoAction({
      version: '0.1.7',
      showMessageBox,
      openExternal,
    })

    await info()

    expect(showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      message: 'office.md 0.1.7',
      detail: expect.stringContaining(OFFICE_MD_REPOSITORY_URL),
    }))
    expect(openExternal).toHaveBeenCalledWith(OFFICE_MD_REPOSITORY_URL)
  })

  it('does not open the repository when the Info dialog is dismissed', async () => {
    const openExternal = vi.fn(async () => undefined)
    const info = createInfoAction({
      version: '0.1.7',
      showMessageBox: async () => ({ response: 1 }),
      openExternal,
    })

    await info()

    expect(openExternal).not.toHaveBeenCalled()
  })

  it('adds Info and Update actions under Help', () => {
    const onInfo = vi.fn()
    const onUpdate = vi.fn()
    const [help] = createHelpMenuTemplate({ onInfo, onUpdate })
    const items = help.submenu

    expect(help.label).toBe('Help')
    expect(items.map((item) => item.label)).toEqual(['Info', 'Update...'])
    items[0].click?.({} as never, {} as never, {} as never)
    items[1].click?.({} as never, {} as never, {} as never)
    expect(onInfo).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenCalledOnce()
  })
})
