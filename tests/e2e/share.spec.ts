import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'
import {
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { expect, test, type Page } from '@playwright/test'

const includedMarkdown = '## Included section\n\nThis content comes from another file.\n'
const documentMarkdown = '# Project document\n\nThis document is stored on disk.\n\n![[included.md]]\n'
const csvSource = 'month,Visitors,Signups,Total\nJan,120,22,=B2+C2\nFeb,148,28,=B3+C3\n'
const imageSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><rect width="24" height="16" fill="#d66b4d"/></svg>'
const themeCss = 'body { color: #333; }\n'

const seedWorkspace = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'office-md-share-e2e-'))
  await writeFile(path.join(directory, 'document.md'), documentMarkdown)
  await writeFile(path.join(directory, 'included.md'), includedMarkdown)
  await writeFile(path.join(directory, 'data.csv'), csvSource)
  await writeFile(path.join(directory, 'theme.css'), themeCss)
  await writeFile(path.join(directory, 'sample.svg'), imageSvg)
  await mkdir(path.join(directory, 'nested'))
  await writeFile(path.join(directory, 'nested', 'note.md'), '# Nested note\n')
  return directory
}

const openWorkspace = async (page: Page, directory: string) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.locator('#startup-choice')).toBeVisible({ timeout: 20_000 })
  await page.locator('#startup-open-folder').click()
  const picker = page.locator('.folder-picker-dialog')
  const input = picker.getByLabel('Folder path')
  await input.fill(directory)
  await input.press('Enter')
  await expect(input).toHaveValue(directory)
  await picker.getByRole('button', { name: 'Open this folder' }).click()
  await expect(page.locator('#folder-status')).toContainText('disk-backed')
  await page.locator('.file-select[title="Open document.md"]').click()
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#debug-markdown-content')).toHaveValue(/Project document/)
}

const makeShareLink = async (page: Page, button: string) => {
  await page.locator(button).click()
  await expect(page.locator('#share-dialog')).toBeVisible()
  await page.locator('#share-confirm').click()
  await expect(page.locator('#share-link-value')).toBeVisible()
  const url = await page.locator('#share-link-value').inputValue()
  await page.locator('#share-cancel').click()
  return url
}

const openShareUrl = async (page: Page, url: string) => {
  await page.goto(url)
  await page.reload()
}

const decodePlainShare = (url: string) => {
  const value = new URL(url).hash.slice(1)
  const envelope = new URLSearchParams(value).get('share')
  if (!envelope) throw new Error('The generated URL has no share payload.')
  const [version, compression, encoded] = envelope.split('.')
  if (version !== 'v1' || (compression !== 'raw' && compression !== 'gzip') || !encoded) {
    throw new Error('The generated share envelope is unsupported.')
  }
  const bytes = Buffer.from(encoded, 'base64url')
  const serialized = compression === 'gzip' ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8')
  return JSON.parse(serialized) as { files: Array<{ path: string; content: string }> }
}

const updateMarkdownSource = async (
  page: Page,
  markdown: string,
) => {
  const source = page.locator('#debug-markdown-content')
  await source.fill(markdown)
  await source.press('Control+Enter')
  await expect(source).toHaveValue(markdown.trimEnd() + '\n')
}

test('reviews, opens, edits, persists, and re-shares an isolated workspace copy', async ({ page }) => {
  const directory = await seedWorkspace()
  try {
    await openWorkspace(page, directory)
    await page.locator('#share-workspace').click()
    await expect(page.locator('.share-file-list li')).toHaveText([
      'data.csv',
      'document.md',
      'included.md',
      'nested/note.md',
      'sample.svg',
      'theme.css',
    ])
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-link-value')).toBeVisible()
    const originalUrl = await page.locator('#share-link-value').inputValue()
    await page.locator('#share-cancel').click()

    await openShareUrl(page, originalUrl)
    await expect(page.locator('#folder-status')).toContainText('separate shared copy saved locally')
    await expect(page.locator('.file-select[title="Insert sample.svg"]')).toBeVisible()
    await expect(page.locator('.file-select[title="Apply theme.css"]')).toBeVisible()
    await page.locator('.file-select[title="Open nested/note.md"]').click()
    await expect(page.locator('#debug-markdown-content')).toHaveValue('# Nested note\n')
    await page.locator('.file-select[title="Open document.md"]').click()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(/!\[\[included\.md\]\]/)

    const edited = '# Recipient edit\n\n![[included.md]]\n'
    await updateMarkdownSource(page, edited)
    await expect(page.locator('#folder-status')).toContainText('separate shared copy saved locally')

    const updatedUrl = await makeShareLink(page, '#share-workspace')
    expect(updatedUrl).not.toBe(originalUrl)
    await openShareUrl(page, updatedUrl)
    await expect(page.locator('#folder-status')).toContainText('separate shared copy saved locally')
    await page.locator('.file-select[title="Open document.md"]').click()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(edited)

    await openShareUrl(page, originalUrl)
    await expect(page.locator('#folder-status')).toContainText('separate shared copy saved locally')
    await page.locator('.file-select[title="Open document.md"]').click()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(edited)
    expect(await readFile(path.join(directory, 'document.md'), 'utf8')).toBe(documentMarkdown)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('creates a portable Markdown file share and keeps CSV formulas in a file share', async ({ page }) => {
  const directory = await seedWorkspace()
  try {
    await openWorkspace(page, directory)
    const markdownUrl = await makeShareLink(page, '#share-file')
    await openShareUrl(page, markdownUrl)
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#document-name')).toHaveText('document.md')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(/## Included section/)
    await expect(page.locator('#debug-markdown-content')).not.toHaveValue(/!\[\[included\.md\]\]/)

    await openWorkspace(page, directory)
    await page.locator('.file-select[title="Open data.csv"]').click()
    await expect(page.locator('#document-name')).toHaveText('data.csv')
    const csvUrl = await makeShareLink(page, '#csv-share-file')
    expect(decodePlainShare(csvUrl).files[0]).toMatchObject({
      path: 'data.csv',
      content: expect.stringContaining('=B2+C2'),
    })
    await openShareUrl(page, csvUrl)
    await expect(page.locator('#csv-spreadsheet')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#document-name')).toHaveText('data.csv')
    await expect(page.locator('#csv-spreadsheet')).toContainText('142')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('lets a recipient edit and re-share a single file as a new snapshot', async ({ page }) => {
  const directory = await seedWorkspace()
  try {
    await openWorkspace(page, directory)
    const originalUrl = await makeShareLink(page, '#share-file')
    await openShareUrl(page, originalUrl)
    await expect(page.locator('#document-name')).toHaveText('document.md')
    const edited = '# Updated file copy\n\nThe recipient made this change.\n'
    await updateMarkdownSource(page, edited)
    await expect(page.locator('#folder-status')).toContainText('separate shared copy saved locally')

    const updatedUrl = await makeShareLink(page, '#share-file')
    expect(updatedUrl).not.toBe(originalUrl)
    await openShareUrl(page, updatedUrl)
    await expect(page.locator('#document-name')).toHaveText('document.md')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(edited)
    expect(await readFile(path.join(directory, 'document.md'), 'utf8')).toBe(documentMarkdown)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('creates and opens a password-protected web link without exposing the password', async ({ page }) => {
  const directory = await seedWorkspace()
  const password = 'a separate strong passphrase'
  try {
    await openWorkspace(page, directory)
    await page.locator('#share-file').click()
    await page.locator('#share-password-toggle').check()
    await page.locator('#share-password').fill(password)
    await page.locator('#share-password-confirm').fill('a different passphrase')
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-dialog')).toContainText('The passwords do not match')
    await page.locator('#share-password-confirm').fill(password)
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-link-value')).toBeVisible()
    const url = await page.locator('#share-link-value').inputValue()
    expect(url).not.toContain(password)
    expect(url).not.toContain('document.md')
    await page.locator('#share-cancel').click()

    const wrongRecipient = await page.context().newPage()
    await wrongRecipient.goto(url)
    await expect(wrongRecipient.locator('#share-dialog')).toBeVisible()
    await wrongRecipient.locator('#share-password').fill('wrong passphrase')
    await wrongRecipient.locator('#share-confirm').click()
    await expect(wrongRecipient.locator('#startup-choice h1')).toHaveText(
      'Could not open this shared document',
    )
    await expect(wrongRecipient.locator('.ProseMirror')).toHaveCount(0)
    await wrongRecipient.close()

    const recipient = await page.context().newPage()
    await recipient.goto(url)
    await expect(recipient.locator('#share-dialog')).toBeVisible()
    await recipient.locator('#share-password').fill(password)
    await recipient.locator('#share-confirm').click()
    await expect(recipient.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
    await expect(recipient.locator('#document-name')).toHaveText('document.md')
    await expect(recipient.locator('#debug-markdown-content')).toHaveValue(/## Included section/)
    await recipient.close()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('warns for long file and workspace URLs and allows the sender to continue', async ({ page }) => {
  const directory = await seedWorkspace()
  try {
    await openWorkspace(page, directory)
    const longMarkdown = '# Long document\n\n' + randomBytes(12_000).toString('base64') + '\n'
    await updateMarkdownSource(page, longMarkdown)

    await page.locator('#share-file').click()
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-dialog')).toContainText('This share link is long')
    await page.locator('#share-cancel').click()

    await page.locator('#share-workspace').click()
    await expect(page.locator('.share-file-list li')).toHaveCount(6)
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-dialog')).toContainText('This share link is long')
    await page.locator('#share-confirm').click()
    await expect(page.locator('#share-link-value')).toBeVisible()
    expect((await page.locator('#share-link-value').inputValue()).length).toBeGreaterThan(8_000)
    await page.locator('#share-cancel').click()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('keeps a shared copy usable and shareable when IndexedDB is unavailable', async ({ page }) => {
  const directory = await seedWorkspace()
  const temporaryPage = await page.context().newPage()
  try {
    await openWorkspace(page, directory)
    const url = await makeShareLink(page, '#share-file')
    await temporaryPage.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined })
    })
    await temporaryPage.goto(url)
    await expect(temporaryPage.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
    await expect(temporaryPage.locator('#folder-status')).toContainText('browser storage unavailable')
    await expect(temporaryPage.locator('#share-file')).toBeEnabled()
    await updateMarkdownSource(temporaryPage, '# Temporary copy edit\n')
    await expect(temporaryPage.locator('#folder-status')).toContainText('browser storage unavailable')
    await temporaryPage.locator('#share-file').click()
    await temporaryPage.locator('#share-confirm').click()
    await expect(temporaryPage.locator('#share-link-value')).toBeVisible()
  } finally {
    await temporaryPage.close()
    await rm(directory, { recursive: true, force: true })
  }
})

const encryptedShareArchive = async (password: string) => {
  const writer = new ZipWriter(new Uint8ArrayWriter())
  const passwordOptions = { password, encryptionStrength: 3 as const }
  const manifest = {
    format: 'office-md-share-archive',
    version: 1,
    id: 'electron-incoming',
    kind: 'file',
    createdAt: new Date().toISOString(),
    entryFile: 'document.md',
    files: [{ path: 'document.md', mimeType: 'text/markdown', encoding: 'utf8' }],
  }
  await writer.add('.office-md-share.json', new TextReader(JSON.stringify(manifest)), passwordOptions)
  await writer.add('document.md', new TextReader('# Electron share\n'), passwordOptions)
  return writer.close()
}

test('opens a password-protected Electron ZIP, edits it, and saves a new protected ZIP', async ({ page }) => {
  const archive = await encryptedShareArchive('incoming passphrase')
  await page.addInitScript((archiveBase64) => {
    const bytes = Uint8Array.from(atob(archiveBase64), (character) => character.charCodeAt(0))
    const bridgeWindow = window as typeof window & {
      officeMd?: unknown
      __savedShareArchive?: number[]
      __shareSuggestedName?: string
    }
    bridgeWindow.__savedShareArchive = undefined
    bridgeWindow.officeMd = {
      styleFolder: {
        restore: async () => undefined,
        reload: async () => undefined,
        readFile: async () => '',
        openFolder: async () => undefined,
      },
      share: {
        openArchive: async () => bytes,
        saveArchive: async (saved: Uint8Array, name: string) => {
          bridgeWindow.__savedShareArchive = Array.from(saved)
          bridgeWindow.__shareSuggestedName = name
          return '/tmp/office-md-share-e2e.zip'
        },
      },
    }
  }, Buffer.from(archive).toString('base64'))

  await page.goto('/')
  await expect(page.locator('#startup-open-share-zip')).toBeVisible({ timeout: 20_000 })
  await page.locator('#startup-open-share-zip').click()
  await expect(page.locator('#share-dialog')).toContainText('Enter the password supplied by the sender')
  await page.locator('#share-password').fill('incoming passphrase')
  await page.locator('#share-confirm').click()
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#document-name')).toHaveText('document.md')

  await updateMarkdownSource(page, '# Updated in Electron\n')
  await page.locator('#share-workspace').click()
  await expect(page.locator('.share-file-list li')).toHaveText(['document.md'])
  await page.locator('#share-password-toggle').check()
  await page.locator('#share-password').fill('outgoing passphrase')
  await page.locator('#share-password-confirm').fill('outgoing passphrase')
  await page.locator('#share-confirm').click()
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as typeof window & { __savedShareArchive?: number[] }).__savedShareArchive?.length,
  ))).toBe(true)
  await expect(page.locator('#save-status')).toHaveAttribute('title', /Saved share ZIP/)

  const saved = await page.evaluate(() => ({
    bytes: (window as typeof window & { __savedShareArchive?: number[] }).__savedShareArchive,
    name: (window as typeof window & { __shareSuggestedName?: string }).__shareSuggestedName,
  }))
  expect(saved.name).toBe('office-md-workspace-share.zip')
  const reader = new ZipReader(new Uint8ArrayReader(Uint8Array.from(saved.bytes ?? [])))
  const entries = await reader.getEntries()
  const manifestEntry = entries.find((entry) => entry.filename === '.office-md-share.json')
  const documentEntry = entries.find((entry) => entry.filename === 'document.md')
  expect(manifestEntry?.encrypted).toBe(true)
  expect(documentEntry?.encrypted).toBe(true)
  const manifestText = await manifestEntry?.getData(new TextWriter(), {
    password: 'outgoing passphrase',
    checkAuthenticationCode: true,
    checkCrc32: true,
  })
  const documentText = await documentEntry?.getData(new TextWriter(), {
    password: 'outgoing passphrase',
    checkAuthenticationCode: true,
    checkCrc32: true,
  })
  await reader.close()
  const manifest = JSON.parse(manifestText ?? '{}') as { id?: string }
  expect(manifest.id).not.toBe('electron-incoming')
  expect(documentText).toBe('# Updated in Electron\n')

  await page.locator('#share-workspace').click()
  await page.locator('#share-confirm').click()
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as typeof window & { __savedShareArchive?: number[] }).__savedShareArchive?.length,
  ))).toBe(true)
  const unencrypted = await page.evaluate(() =>
    (window as typeof window & { __savedShareArchive?: number[] }).__savedShareArchive,
  )
  if (process.platform === 'linux' && existsSync('/usr/bin/unzip')) {
    const extractionDirectory = await mkdtemp(path.join(tmpdir(), 'office-md-share-unzip-'))
    try {
      const archivePath = path.join(extractionDirectory, 'share.zip')
      const extractedDirectory = path.join(extractionDirectory, 'extracted')
      await writeFile(archivePath, Uint8Array.from(unencrypted ?? []))
      execFileSync('/usr/bin/unzip', ['-t', archivePath])
      execFileSync('/usr/bin/unzip', ['-q', archivePath, '-d', extractedDirectory])
      expect(await readFile(path.join(extractedDirectory, 'document.md'), 'utf8'))
        .toBe('# Updated in Electron\n')
      expect(await readFile(path.join(extractedDirectory, '.office-md-share.json'), 'utf8'))
        .toContain('office-md-share-archive')
    } finally {
      await rm(extractionDirectory, { recursive: true, force: true })
    }
  }
})
