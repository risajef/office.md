import { describe, expect, it } from 'vitest'
import {
  getManualUpdateUnavailableReason,
  isManualUpdateEnabled,
  isSupportedUpdateTarget,
} from '../../electron/update-availability'

describe('manual Electron update availability', () => {
  it.each([
    ['unpackaged', false, {}],
    ['development server', true, { OFFICE_MD_DEV_SERVER_URL: 'http://127.0.0.1:4173' }],
    ['test workspace', true, { OFFICE_MD_TEST_WORKSPACE: '/tmp/workspace' }],
    ['test mode', true, { OFFICE_MD_TEST_MODE: '1' }],
    ['disabled by environment', true, { OFFICE_MD_DISABLE_UPDATES: '1' }],
    ['Node test process', true, { NODE_ENV: 'test' }],
  ])('disables update lookup in a %s session', (_name, isPackaged, environment) => {
    expect(isManualUpdateEnabled({ isPackaged, environment })).toBe(false)
  })

  it('allows manual lookup in a packaged, non-test session', () => {
    expect(isManualUpdateEnabled({
      isPackaged: true,
      environment: {},
    })).toBe(true)
  })

  it('supports installed x64 Linux AppImage releases', () => {
    expect(isSupportedUpdateTarget('linux', 'x64')).toBe(true)
    expect(isManualUpdateEnabled({
      isPackaged: true,
      environment: {},
    })).toBe(true)
  })

  it('explains when a Linux development run cannot install an update', () => {
    expect(getManualUpdateUnavailableReason({
      isPackaged: false,
      isSupportedTarget: isSupportedUpdateTarget('linux', 'x64'),
      environment: {},
    })).toMatch(/installed AppImage/)
  })

  it('does not enable unsupported architectures', () => {
    expect(isSupportedUpdateTarget('linux', 'arm64')).toBe(false)
    expect(isSupportedUpdateTarget('darwin', 'x64')).toBe(false)
  })
})
