import { describe, expect, it, vi } from 'vitest'
import { createOpenManagedStyleFolderHandler } from '../../electron/open-managed-style-folder'

describe('managed styles folder file-manager action', () => {
  it('opens only the app-managed path and ignores renderer-supplied arguments', async () => {
    const openPath = vi.fn(async () => '')
    const handler = createOpenManagedStyleFolderHandler(
      { openPath },
      () => '/app/user-data/styles',
    )

    await (handler as (...args: unknown[]) => Promise<void>)('/tmp/untrusted-styles')

    expect(openPath).toHaveBeenCalledOnce()
    expect(openPath).toHaveBeenCalledWith('/app/user-data/styles')
  })

  it('reports file-manager failures to the caller', async () => {
    const handler = createOpenManagedStyleFolderHandler(
      { openPath: async () => 'No file manager is available.' },
      () => '/app/user-data/styles',
    )

    await expect(handler()).rejects.toThrow('No file manager is available.')
  })
})
