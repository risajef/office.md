import { existsSync } from 'node:fs'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type Page } from '@playwright/test'
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

const openTestWorkspace = async (page: Page) => {
  await expect(page.locator('#startup-choice')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#startup-open-folder')).toBeEnabled({ timeout: 30_000 })
  await page.locator('#startup-open-folder').click()
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 })
}

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
    await openTestWorkspace(page)
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

test('Electron opens a selected Markdown file with its immediate parent workspace', async () => {
  test.skip(!existsSync(electronPath), 'Electron binary is not installed.')
  test.skip(needsXvfb && !existsSync('/usr/bin/Xvfb'), 'Xvfb is not installed.')

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-open-file-'))
  const nested = path.join(workspace, 'nested')
  const userData = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-open-file-user-'))
  await mkdir(nested)
  await writeFile(path.join(nested, 'selected.markdown'), '# Selected document\n')
  await writeFile(path.join(nested, 'ignored.txt'), 'not supported')
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  environment.OFFICE_MD_DEV_SERVER_URL = 'http://127.0.0.1:4173'
  environment.OFFICE_MD_TEST_FILE = path.join(nested, 'selected.markdown')
  const virtualDisplay = needsXvfb ? await startXvfb() : undefined
  if (virtualDisplay) environment.DISPLAY = virtualDisplay.display
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined

  try {
    application = await electron.launch({
      executablePath: electronPath,
      args: [process.cwd(), `--user-data-dir=${userData}`],
      env: environment,
    })
    const page = application.windows()[0] ?? await application.firstWindow()
    await expect(page.locator('#startup-choice')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('#startup-open-file')).toBeEnabled({ timeout: 30_000 })
    await page.locator('#startup-open-file').click()
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('#folder-status')).toContainText('nested · 1 files · disk-backed')
    await expect(page.locator('#document-name')).toHaveText('selected.markdown')
    await expect(page.locator('#debug-markdown-content')).toHaveValue('# Selected document\n')
  } finally {
    await application?.close()
    virtualDisplay?.process.kill()
    await rm(workspace, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})

test('shows Help information and update actions without a startup update notification', async () => {
  test.skip(!existsSync(electronPath), 'Electron binary is not installed.')
  test.skip(needsXvfb && !existsSync('/usr/bin/Xvfb'), 'Xvfb is not installed.')

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-help-e2e-'))
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
    await openTestWorkspace(page)
    await expect(page.locator('#editor')).toBeVisible()
    await expect(page.locator('#update-notification')).toHaveCount(0)
    expect(await page.evaluate(() => Boolean(window.officeMd?.workspace))).toBe(true)
    expect(await page.evaluate(() => 'updates' in (window.officeMd ?? {}))).toBe(false)

    const helpActions = await application.evaluate(({ Menu }) => {
      const helpMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Help')
      return helpMenu?.submenu?.items.map((item) => item.label)
    })
    expect(helpActions).toEqual(['Info', 'Update...'])
    expect(application.windows()).toHaveLength(1)
  } finally {
    await application?.close()
    virtualDisplay?.process.kill()
    await rm(workspace, { recursive: true, force: true })
  }
})

test('restores the last readable independent style folder across Electron launches', async () => {
  test.skip(!existsSync(electronPath), 'Electron binary is not installed.')
  test.skip(needsXvfb && !existsSync('/usr/bin/Xvfb'), 'Xvfb is not installed.')

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-style-workspace-'))
  const styles = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-style-folder-'))
  const userData = await mkdtemp(path.join(os.tmpdir(), 'office-md-electron-style-user-data-'))
  await writeRepresentativeWorkspace(workspace)
  await writeFile(path.join(styles, 'desktop.css'), '.ProseMirror { color: rgb(30, 90, 160); }\n')

  const launch = async (stylePath?: string) => {
    const environment = { ...process.env }
    delete environment.ELECTRON_RUN_AS_NODE
    environment.OFFICE_MD_DEV_SERVER_URL = 'http://127.0.0.1:4173'
    environment.OFFICE_MD_TEST_WORKSPACE = workspace
    if (stylePath) environment.OFFICE_MD_TEST_STYLE_FOLDER = stylePath
    else delete environment.OFFICE_MD_TEST_STYLE_FOLDER
    const virtualDisplay = needsXvfb ? await startXvfb() : undefined
    if (virtualDisplay) environment.DISPLAY = virtualDisplay.display
    const application = await electron.launch({
      executablePath: electronPath,
      args: [process.cwd(), `--user-data-dir=${userData}`],
      env: environment,
    })
    return { application, virtualDisplay }
  }

  let first: Awaited<ReturnType<typeof launch>> | undefined
  let second: Awaited<ReturnType<typeof launch>> | undefined
  let third: Awaited<ReturnType<typeof launch>> | undefined
  try {
    first = await launch(styles)
    const firstPage = first.application.windows()[0] ?? await first.application.firstWindow()
    await openTestWorkspace(firstPage)
    await firstPage.locator('#open-style-folder').click()
    await expect(firstPage.locator('#style-folder-status')).toContainText('1 CSS themes')
    await expect(firstPage.locator('.style-theme-select[data-theme-origin="style-folder"]'))
      .toHaveCount(1)
    await first.application.close()
    first.virtualDisplay?.process.kill()
    first = undefined

    second = await launch()
    const secondPage = second.application.windows()[0] ?? await second.application.firstWindow()
    await openTestWorkspace(secondPage)
    await expect(secondPage.locator('#style-folder-status')).toContainText('1 CSS themes')
    await expect(secondPage.locator('.style-theme-select[data-theme-origin="style-folder"]'))
      .toHaveCount(1)
    await second.application.close()
    second.virtualDisplay?.process.kill()
    second = undefined

    await rm(styles, { recursive: true, force: true })
    third = await launch()
    const thirdPage = third.application.windows()[0] ?? await third.application.firstWindow()
    await expect(thirdPage.locator('#startup-choice')).toBeVisible({ timeout: 30_000 })
    await expect(thirdPage.locator('#startup-open-folder')).toBeVisible()
    await expect(thirdPage.locator('.style-theme-select[data-theme-origin="style-folder"]'))
      .toHaveCount(0)
  } finally {
    await first?.application.close()
    first?.virtualDisplay?.process.kill()
    await second?.application.close()
    second?.virtualDisplay?.process.kill()
    await third?.application.close()
    third?.virtualDisplay?.process.kill()
    await rm(workspace, { recursive: true, force: true })
    await rm(styles, { recursive: true, force: true })
    await rm(userData, { recursive: true, force: true })
  }
})
