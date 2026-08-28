import { existsSync } from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { writeRepresentativeWorkspace } from '../fixtures/representative-workspace'

const electronPath = process.env.ELECTRON_PATH
  ?? path.resolve('node_modules/electron/dist/electron')
const needsXvfb = process.platform === 'linux' && !process.env.DISPLAY

const startXvfb = () => new Promise<{
  process: ChildProcessWithoutNullStreams
  display: string
}>((resolve, reject) => {
  const server = spawn('/usr/bin/Xvfb', [
    '-displayfd',
    '1',
    '-screen',
    '0',
    '1440x960x24',
    '-nolisten',
    'tcp',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  let settled = false
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    server.kill()
    reject(new Error('Xvfb did not report a display in time.'))
  }, 5_000)
  server.stdout.once('data', (chunk: Buffer) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    resolve({ process: server, display: `:${chunk.toString().trim()}` })
  })
  server.once('error', (error) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    reject(error)
  })
})

test('Electron shell loads the shared renderer and secure workspace bridge', async () => {
  test.skip(!existsSync(electronPath), 'Electron binary is not installed.')
  test.skip(needsXvfb && !existsSync('/usr/bin/Xvfb'), 'Xvfb is not installed.')

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-e2e-'))
  await writeRepresentativeWorkspace(workspace)
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  environment.OFFICE_MD_DEV_SERVER_URL = 'http://127.0.0.1:4173'
  environment.OFFICE_MD_TEST_WORKSPACE = workspace
  const virtualDisplay = needsXvfb ? await startXvfb() : undefined
  if (virtualDisplay) environment.DISPLAY = virtualDisplay.display
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  try {
    application = await electron.launch({
      executablePath: electronPath,
      args: [process.cwd()],
      env: environment,
    })
    const page = application.windows()[0] ?? await application.firstWindow()
    await expect(page.locator('#editor')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('#open-folder')).toBeVisible()
    await expect(page.locator('#folder-status')).toContainText('disk-backed')
    await expect(page.locator('#document-name')).toHaveText('document.md')
    expect(await page.evaluate(() => Boolean(window.officeMd?.workspace))).toBe(true)
  } finally {
    await application?.close()
    virtualDisplay?.process.kill()
    await rm(workspace, { recursive: true, force: true })
  }
})
