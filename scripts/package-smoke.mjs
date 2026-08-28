import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const unpackedDirectory = process.env.PACKAGED_APP_DIR
  ? path.resolve(process.env.PACKAGED_APP_DIR)
  : path.join(
      projectRoot,
      'release',
      process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked',
    )
const executableName = process.platform === 'win32'
  ? 'milkdown-minimal-editor.exe'
  : 'milkdown-minimal-editor'
const executablePath = process.env.PACKAGED_APP_PATH
  ? path.resolve(process.env.PACKAGED_APP_PATH)
  : path.join(unpackedDirectory, executableName)

if (!existsSync(executablePath)) {
  throw new Error(`Packaged Electron executable not found: ${executablePath}`)
}

const workspace = await mkdtemp(path.join(os.tmpdir(), 'office-md-packaged-smoke-'))
await writeFile(
  path.join(workspace, 'document.md'),
  '# Packaged smoke test\n\nThe bundled renderer is available.\n',
  'utf8',
)

const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
delete environment.OFFICE_MD_DEV_SERVER_URL
environment.OFFICE_MD_TEST_WORKSPACE = workspace

const debugPort = 40_000 + Math.floor(Math.random() * 10_000)
const launchArguments = [
  `--remote-debugging-port=${debugPort}`,
  ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
]
const application = spawn(executablePath, launchArguments, {
  env: environment,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let errorOutput = ''
application.stderr.on('data', (chunk) => {
  errorOutput += chunk.toString()
})

const waitForDebugEndpoint = async () => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (application.exitCode !== null) {
      throw new Error(
        `The packaged Electron application exited with code ${application.exitCode}. ${errorOutput}`,
      )
    }
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`)
      if (response.ok) return
    } catch {
      // The packaged application can take a few seconds to start its DevTools endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`The packaged Electron application did not expose a DevTools endpoint. ${errorOutput}`)
}

let browser
try {
  await waitForDebugEndpoint()
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
  const context = browser.contexts()[0]
  if (!context) throw new Error('The packaged Electron application has no browser context.')
  const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: 30_000 })
  await page.locator('#editor').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('#folder-status').waitFor({ state: 'visible', timeout: 30_000 })
  const bridgeAvailable = await page.evaluate(() => Boolean(globalThis.officeMd?.workspace))
  if (!bridgeAvailable) {
    throw new Error('The packaged renderer cannot access the secure workspace bridge.')
  }
} finally {
  await browser?.close()
  if (application.exitCode === null) application.kill()
  await rm(workspace, { recursive: true, force: true })
}
