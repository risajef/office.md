import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

const documentMarkdown = `# Project document

This document is stored on disk.

[asdf qwer](https://example.com)

| Name | Value |
| --- | --- |
| Alpha | 1 |
| Beta | 2 |

![[included.md]]

\`\`\`javascript
const themed = true
\`\`\`

\`\`\`mermaid(data.csv)
flowchart LR
  A2 --> B2
  A3 --> B3
\`\`\`

---

## Second page

Content after a forced page break.
`

const includedMarkdown = `## Included section

This content comes from another file.
`

const csvSource = `month,Visitors,Signups,Total
Jan,120,22,=B2+C2
Feb,148,28,=B3+C3
Mar,176,35,=B4+C4
`

const imageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16" viewBox="0 0 24 16"><rect width="24" height="16" fill="#d66b4d"/><circle cx="8" cy="7" r="3" fill="#f6d365"/></svg>`

const themeCss = `:root {
  --page-bg: rgb(31, 32, 33);
  --paper: rgb(245, 246, 247);
  --code-background: rgb(20, 30, 40);
  --document-font: "Courier New", monospace;
  --heading-font: "Courier New", monospace;
  --diagram-font: "Courier New", monospace;
}

body { background: rgb(31, 32, 33); }
#editor .ProseMirror { font-family: var(--document-font); }
`

type Workspace = {
  directory: string
  file: (name: string) => string
}

const seedWorkspace = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'office-md-e2e-'))
  await writeFile(path.join(directory, 'document.md'), documentMarkdown)
  await writeFile(path.join(directory, 'included.md'), includedMarkdown)
  await writeFile(path.join(directory, 'data.csv'), csvSource)
  await writeFile(path.join(directory, 'theme.css'), themeCss)
  await writeFile(path.join(directory, 'sample.svg'), imageSvg)
  await mkdir(path.join(directory, 'empty-folder'))
  return {
    directory,
    file: (name: string) => path.join(directory, name),
  }
}

const waitForEditor = async (page: Page) => {
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#document-name')).not.toHaveText('untitled.md', {
    timeout: 20_000,
  })
}

const openWorkspace = async (page: Page, directory: string) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 20_000 })

  await page.locator('#open-folder').click()
  const dialog = page.locator('.folder-picker-dialog')
  await expect(dialog).toBeVisible()
  const pathInput = dialog.getByLabel('Folder path')
  await expect(pathInput).toBeEnabled()
  await pathInput.fill(directory)
  await pathInput.press('Enter')
  await expect(pathInput).toHaveValue(directory)
  const openButton = dialog.getByRole('button', { name: 'Open this folder' })
  await expect(openButton).toBeEnabled()
  await openButton.click()

  await expect(page.locator('#folder-status')).toContainText('disk-backed')
  await expect(page.locator('#document-name')).toHaveText('document.md')
  await expect(page).toHaveTitle('document.md')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  )
  await expect(page.locator('#debug-markdown-content')).toHaveValue(
    /Project document/,
  )
}

const editMarkdownSource = async (page: Page, markdown: string) => {
  const source = page.locator('#debug-markdown-content')
  await source.fill(markdown)
  await source.press('Control+Enter')
  await expect(source).toHaveValue(`${markdown.trimEnd()}\n`)
}

const storeMarkdown = (page: Page) => page.locator(
  '.editor-card [data-project-action="store"]',
).click()

const test = base.extend<{ workspace: Workspace }>({
  workspace: [async ({ page }, use) => {
    const workspace = await seedWorkspace()
    await openWorkspace(page, workspace.directory)
    try {
      await use(workspace)
    } finally {
      await rm(workspace.directory, { recursive: true, force: true })
    }
  }, { auto: true }],
})

base.describe('local filesystem bridge', () => {
  let workspace: Workspace

  base.beforeEach(async () => {
    workspace = await seedWorkspace()
    await mkdir(workspace.file('node_modules'))
    await writeFile(workspace.file('node_modules/ignored.md'), 'ignored')
    await mkdir(workspace.file('.hidden-folder'))
    await writeFile(workspace.file('.hidden-folder/ignored.md'), 'ignored')
    await writeFile(workspace.file('.hidden.md'), 'ignored')
    await writeFile(workspace.file('notes.txt'), 'ignored')
    await writeFile(workspace.file('image.png'), 'not really an image')
  })

  base.afterEach(async () => {
    await rm(workspace.directory, { recursive: true, force: true })
  })

  const openThroughApi = async (
    request: APIRequestContext,
    inputPath: string,
  ) => {
    const response = await request.post('/__office_md_fs/open', {
      data: { path: inputPath },
    })
    expect(response.ok()).toBe(true)
    return response.json() as Promise<{
      workspace: { id: string; path: string }
      files: Array<{ name: string; markdown: string }>
      directories: string[]
    }>
  }

  base('opens WSL paths and performs real write, rename, and reload effects', async ({
    request,
  }) => {
    const windowsPath = `\\\\wsl$\\Ubuntu${workspace.directory.replaceAll('/', '\\')}`
    const snapshot = await openThroughApi(request, windowsPath)
    expect(snapshot.workspace.path).toBe(workspace.directory)
    expect(snapshot.files.map((file) => file.name)).toEqual([
      'data.csv',
      'document.md',
      'image.png',
      'included.md',
      'sample.svg',
      'theme.css',
    ])
    expect(snapshot.directories).toEqual(['empty-folder'])

    const write = await request.post('/__office_md_fs/write', {
      data: {
        workspaceId: snapshot.workspace.id,
        name: 'notes/new.md',
        markdown: '# Written through the bridge',
      },
    })
    expect(write.ok()).toBe(true)
    expect(await readFile(workspace.file('notes/new.md'), 'utf8')).toBe(
      '# Written through the bridge',
    )

    const rename = await request.post('/__office_md_fs/rename', {
      data: {
        workspaceId: snapshot.workspace.id,
        oldName: 'notes/new.md',
        newName: 'archive/renamed.md',
      },
    })
    expect(rename.ok()).toBe(true)
    await expect(access(workspace.file('notes/new.md'))).rejects.toThrow()
    expect(await readFile(workspace.file('archive/renamed.md'), 'utf8')).toBe(
      '# Written through the bridge',
    )

    const reload = await request.post('/__office_md_fs/reload', {
      data: { workspaceId: snapshot.workspace.id },
    })
    expect(reload.ok()).toBe(true)
    const reloaded = await reload.json() as { files: Array<{ name: string }> }
    expect(reloaded.files.map((file) => file.name)).toContain('archive/renamed.md')
    expect(reloaded.files.map((file) => file.name)).toContain('image.png')
    expect(reloaded.files.map((file) => file.name)).not.toContain(
      'node_modules/ignored.md',
    )
  })

  base('loads a folder when the workspace cache exceeds browser storage', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'milkdown-editor-files-v4') {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        originalSetItem.call(this, key, value)
      }
    })

    await openWorkspace(page, workspace.directory)
  })

  base('rejects overwrite and path escape attempts without damaging files', async ({
    request,
  }) => {
    await writeFile(workspace.file('existing.md'), 'destination')
    const snapshot = await openThroughApi(request, workspace.directory)

    const collision = await request.post('/__office_md_fs/rename', {
      data: {
        workspaceId: snapshot.workspace.id,
        oldName: 'document.md',
        newName: 'existing.md',
      },
    })
    expect(collision.status()).toBe(400)
    expect(await readFile(workspace.file('document.md'), 'utf8')).toBe(documentMarkdown)
    expect(await readFile(workspace.file('existing.md'), 'utf8')).toBe('destination')

    const escape = await request.post('/__office_md_fs/write', {
      data: {
        workspaceId: snapshot.workspace.id,
        name: '../outside.md',
        markdown: 'outside',
      },
    })
    expect(escape.status()).toBe(400)
  })

  base('creates and deletes files and empty folders through the bridge', async ({
    request,
  }) => {
    const snapshot = await openThroughApi(request, workspace.directory)
    const folder = await request.post('/__office_md_fs/mkdir', {
      data: { workspaceId: snapshot.workspace.id, name: 'created-folder' },
    })
    expect(folder.ok()).toBe(true)
    await expect(access(workspace.file('created-folder'))).resolves.toBeUndefined()

    const nonEmpty = await request.post('/__office_md_fs/mkdir', {
      data: { workspaceId: snapshot.workspace.id, name: 'non-empty' },
    })
    expect(nonEmpty.ok()).toBe(true)
    const nestedFile = await request.post('/__office_md_fs/write', {
      data: {
        workspaceId: snapshot.workspace.id,
        name: 'non-empty/inside.md',
        markdown: 'inside',
      },
    })
    expect(nestedFile.ok()).toBe(true)
    const rejectedDelete = await request.post('/__office_md_fs/delete-directory', {
      data: { workspaceId: snapshot.workspace.id, name: 'non-empty' },
    })
    expect(rejectedDelete.status()).toBe(400)

    const deletedFile = await request.post('/__office_md_fs/delete-file', {
      data: { workspaceId: snapshot.workspace.id, name: 'document.md' },
    })
    expect(deletedFile.ok()).toBe(true)
    await expect(access(workspace.file('document.md'))).rejects.toThrow()

    const deletedFolder = await request.post('/__office_md_fs/delete-directory', {
      data: { workspaceId: snapshot.workspace.id, name: 'created-folder' },
    })
    expect(deletedFolder.ok()).toBe(true)
    await expect(access(workspace.file('created-folder'))).rejects.toThrow()
  })
})

test.describe('disk-backed editor workflows', () => {
  test('autosaves to disk, and Reload rereads disk', async ({
    page,
    workspace,
  }) => {
    const changed = '# Edited locally\n\nThis should reach disk automatically.'
    await page.evaluate(() => {
      const editor = document.querySelector('.milkdown')
      ;(window as typeof window & { __editorWasRemoved?: boolean }).__editorWasRemoved = false
      new MutationObserver((records) => {
        if (records.some((record) => [...record.removedNodes].includes(editor as Node))) {
          ;(window as typeof window & { __editorWasRemoved?: boolean }).__editorWasRemoved = true
        }
      }).observe(document.body, { childList: true, subtree: true })
    })
    await editMarkdownSource(page, changed)
    await expect.poll(
      () => readFile(workspace.file('document.md'), 'utf8'),
    ).toBe(`${changed}\n`)
    expect(await page.evaluate(() => (
      window as typeof window & { __editorWasRemoved?: boolean }
    ).__editorWasRemoved)).toBe(false)

    const storedDirectly = '# Stored directly\n\nImmediate save.'
    await editMarkdownSource(page, storedDirectly)
    await storeMarkdown(page)
    await expect.poll(
      () => readFile(workspace.file('document.md'), 'utf8'),
    ).toBe(`${storedDirectly}\n`)

    const external = '# Changed on disk\n\nReloaded content.'
    await writeFile(workspace.file('document.md'), external)
    await page.locator('.editor-card [data-project-action="reload"]').click()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(`${external}\n`)
    await expect(page.locator('.ProseMirror')).toContainText('Changed on disk')
  })

  test('renames the active file on disk and creates new disk files', async ({
    page,
    workspace,
  }) => {
    await page.locator('#rename-document').click()
    await page.locator('#source-dialog-input').fill('renamed.md')
    await page.locator('#source-dialog-submit').click()
    await expect(page.locator('#document-name')).toHaveText('renamed.md')
    await expect(page).toHaveTitle('renamed.md')
    await expect(access(workspace.file('document.md'))).rejects.toThrow()
    expect(await readFile(workspace.file('renamed.md'), 'utf8')).toBe(documentMarkdown)

    await page.locator('.editor-card [data-project-action="reload"]').click()
    await expect(page.locator('#document-name')).toHaveText('renamed.md')

    await page.locator('#new-file').click()
    await page.getByRole('option', { name: /Markdown document/ }).click()
    await expect(page.locator('#source-dialog-input')).toHaveValue('untitled')
    await page.locator('#source-dialog-input').fill('new-notes')
    await page.locator('#source-dialog-input').press('Enter')
    await expect(page.locator('#document-name')).toHaveText('new-notes.md')
    await expect(page).toHaveTitle('new-notes.md')
    await expect.poll(() => readFile(workspace.file('new-notes.md'), 'utf8')).toContain(
      '# new-notes',
    )

    await editMarkdownSource(page, '# New notes\n\nStored content.')
    await storeMarkdown(page)
    await expect.poll(() => readFile(workspace.file('new-notes.md'), 'utf8')).toContain(
      'Stored content.',
    )

    await page.locator('#new-file').click()
    await page.getByRole('option', { name: /CSV spreadsheet/ }).click()
    await page.locator('#source-dialog-input').fill('new-data')
    await page.locator('#source-dialog-input').press('Enter')
    await expect(page.locator('#csv-editor-card')).toBeVisible()
    await expect(page.locator('#csv-editor-name')).toHaveText('new-data.csv')
    await expect(page).toHaveTitle('new-data.csv')
    await expect.poll(() => readFile(workspace.file('new-data.csv'), 'utf8')).toBe('')

    await page.locator('#new-folder').click()
    await page.locator('#source-dialog-input').fill('created-folder')
    await page.locator('#source-dialog-input').press('Enter')
    await expect(page.locator('.folder-label', { hasText: 'created-folder' })).toHaveText(
      'created-folder',
    )
    await expect(access(workspace.file('created-folder'))).resolves.toBeUndefined()
    await page.getByRole('button', { name: 'Delete created-folder' }).click()
    await page.getByRole('option', { name: 'Delete' }).click()
    await expect(access(workspace.file('created-folder'))).rejects.toThrow()
    await expect(page.locator('.folder-label', { hasText: 'created-folder' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Delete new-data.csv' }).click()
    await page.getByRole('option', { name: 'Delete' }).click()
    await expect(access(workspace.file('new-data.csv'))).rejects.toThrow()
    await expect(page.locator('#document-name')).toHaveText('new-notes.md')
  })

  test('edits formulas and rows, stores source CSV, exports evaluated CSV, and renames it', async ({
    page,
    workspace,
  }) => {
    await page.locator('[title="Open data.csv"]').click()
    await expect(page.locator('#csv-editor-card')).toBeVisible()
    await expect(page).toHaveTitle('data.csv')
    await expect(page.locator('#document-outline')).toContainText('No outline for CSV files')
    await expect(page.locator('#rename-csv-document')).toBeEnabled()

    const formula = await page.evaluate(() => {
      const sheet = (document.querySelector('.jss_container') as HTMLElement & {
        jssWorksheet?: {
          setValue: (cell: string, value: string) => void
          getValue: (cell: string, processed?: boolean) => unknown
        }
      })?.jssWorksheet
      sheet?.setValue('D3', '=B3*C3')
      return {
        raw: sheet?.getValue('D3'),
        processed: sheet?.getValue('D3', true),
      }
    })
    expect(formula.raw).toBe('=B3*C3')
    expect(String(formula.processed)).toBe('4144')
    await expect.poll(() => readFile(workspace.file('data.csv'), 'utf8')).toContain(
      '=B3*C3',
    )

    await page.locator('.csv-editor-card [data-project-action="store"]').click()
    await expect.poll(() => readFile(workspace.file('data.csv'), 'utf8')).toContain(
      '=B3*C3',
    )

    const downloadPromise = page.waitForEvent('download')
    await page.locator('.csv-editor-card [data-file-export]').click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(download.suggestedFilename()).toBe('data.csv')
    expect(await readFile(downloadedPath as string, 'utf8')).toContain('4144')
    expect(await readFile(downloadedPath as string, 'utf8')).not.toContain('=B3*C3')

    const rowCountBefore = await page.locator(
      '#csv-spreadsheet tbody tr',
    ).count()
    const cell = page.locator('#csv-spreadsheet td[data-x="1"][data-y="1"]')
    await cell.click()
    const cellBox = await cell.boundingBox()
    expect(cellBox).not.toBeNull()
    await page.mouse.move(
      (cellBox?.x ?? 0) + (cellBox?.width ?? 0) / 2,
      (cellBox?.y ?? 0) + (cellBox?.height ?? 0) / 2,
    )
    await page.mouse.down({ button: 'right' })
    expect(await page.locator('#csv-spreadsheet .jss_contextmenu').evaluateAll(
      (menus) => menus.filter((menu) => getComputedStyle(menu).display !== 'none').length,
    )).toBe(0)
    await page.mouse.up({ button: 'right' })

    const contextToolbar = page.locator('.csv-context-toolbar')
    const insertRow = page.getByRole('button', {
      name: 'Insert a blank row after the selected row',
    })
    await expect(contextToolbar).toBeVisible()
    expect(await contextToolbar.evaluate((element) => ({
      parent: element.parentElement?.tagName,
      position: getComputedStyle(element).position,
    }))).toEqual({ parent: 'BODY', position: 'fixed' })
    await expect(insertRow).toHaveAttribute(
      'data-tooltip',
      'Insert a blank row after the selected row',
    )
    await insertRow.hover()
    await expect.poll(() => insertRow.evaluate(
      (element) => getComputedStyle(element, '::after').opacity,
    )).toBe('1')
    expect(await insertRow.evaluate(
      (element) => getComputedStyle(element, '::after').content,
    )).toContain('Insert a blank row after the selected row')

    await page.mouse.click(4, 4)
    await expect(contextToolbar).toBeHidden()
    await cell.click({ button: 'right' })
    await expect(insertRow).toBeVisible()
    await insertRow.click()
    await expect(page.locator('#csv-spreadsheet tbody tr')).toHaveCount(
      rowCountBefore + 1,
    )

    await page.locator('#rename-csv-document').click()
    await page.locator('#source-dialog-input').fill('renamed-data.csv')
    await page.locator('#source-dialog-submit').click()
    await expect(page.locator('#csv-editor-name')).toHaveText('renamed-data.csv')
    await expect(page).toHaveTitle('renamed-data.csv')
    await expect(access(workspace.file('data.csv'))).rejects.toThrow()
    await expect(access(workspace.file('renamed-data.csv'))).resolves.toBeUndefined()
  })
})

test.describe('rich document behavior', () => {
  test('keeps document toolbars visible while scrolling', async ({ page }) => {
    const toolbarStack = page.locator('.editor-toolbar-stack')
    const outline = page.locator('.outline-sidebar')
    const files = page.locator('.workspace-sidebar')
    await expect(toolbarStack).toBeVisible()
    await expect(outline).toBeVisible()
    await expect(files).toBeVisible()
    await expect.poll(() => toolbarStack.evaluate(
      (element) => getComputedStyle(element).position,
    )).toBe('sticky')
    await expect(outline).toHaveCSS('position', 'sticky')
    await expect(files).toHaveCSS('position', 'sticky')

    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
    await expect.poll(() => toolbarStack.evaluate(
      (element) => Math.round(element.getBoundingClientRect().top),
    )).toBe(0)
    await expect(page.locator('#layout-mode')).toBeVisible()
    await expect(page.locator(
      '.rich-content-toolbar--persistent [data-command="formula"]',
    )).toBeVisible()
    await expect.poll(() => outline.evaluate(
      (element) => Math.round(element.getBoundingClientRect().top),
    )).toBe(8)
    await expect.poll(() => files.evaluate(
      (element) => Math.round(element.getBoundingClientRect().top),
    )).toBe(8)
  })

  test('prioritizes sidebars and restores the automatic document width', async ({
    page,
  }) => {
    const main = page.locator('.workspace-main')
    const outline = page.locator('.outline-sidebar')
    const files = page.locator('.workspace-sidebar')
    await page.setViewportSize({ width: 1400, height: 900 })
    await expect(outline).toBeVisible()
    await expect(files).toBeVisible()
    await expect(page.locator('.workspace-resizer')).toHaveCount(2)
    await expect(page.locator('#outline-resizer')).toBeVisible()
    await expect(page.locator('#files-resizer')).toBeVisible()
    const wideWidth = await main.evaluate(
      (element) => Math.round(element.getBoundingClientRect().width),
    )

    await page.setViewportSize({ width: 1200, height: 900 })
    await expect.poll(() => main.evaluate(
      (element) => Math.round(element.getBoundingClientRect().width),
    )).toBeLessThan(wideWidth)

    await page.setViewportSize({ width: 1400, height: 900 })
    await expect.poll(() => main.evaluate(
      (element) => Math.round(element.getBoundingClientRect().width),
    )).toBe(wideWidth)

    await page.setViewportSize({ width: 1000, height: 900 })
    await expect(outline).toBeHidden()
    await expect(files).toBeVisible()

    await page.setViewportSize({ width: 700, height: 900 })
    await expect(outline).toBeHidden()
    await expect(files).toBeHidden()
  })

  test('resizes and collapses both workspace sidebars', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const outline = page.locator('.outline-sidebar')
    const files = page.locator('.workspace-sidebar')
    const outlineResizer = page.locator('#outline-resizer')
    const filesResizer = page.locator('#files-resizer')

    const outlineWidth = await outline.evaluate(
      (element) => element.getBoundingClientRect().width,
    )
    const outlineHandle = await outlineResizer.boundingBox()
    expect(outlineHandle).not.toBeNull()
    await page.mouse.move(
      outlineHandle!.x + outlineHandle!.width / 2,
      outlineHandle!.y + 100,
    )
    await page.mouse.down()
    await page.mouse.move(
      outlineHandle!.x + outlineHandle!.width / 2 + 60,
      outlineHandle!.y + 100,
    )
    await page.mouse.up()
    await expect.poll(() => outline.evaluate(
      (element) => element.getBoundingClientRect().width,
    )).toBeGreaterThan(outlineWidth)

    const filesWidth = await files.evaluate(
      (element) => element.getBoundingClientRect().width,
    )
    const filesHandle = await filesResizer.boundingBox()
    expect(filesHandle).not.toBeNull()
    await page.mouse.move(
      filesHandle!.x + filesHandle!.width / 2,
      filesHandle!.y + 100,
    )
    await page.mouse.down()
    await page.mouse.move(
      filesHandle!.x + filesHandle!.width / 2 - 60,
      filesHandle!.y + 100,
    )
    await page.mouse.up()
    await expect.poll(() => files.evaluate(
      (element) => element.getBoundingClientRect().width,
    )).toBeGreaterThan(filesWidth)

    await page.locator('#toggle-outline').click()
    await expect(outline).toBeHidden()
    await expect(page.locator('#workspace-layout')).toHaveAttribute(
      'data-outline-collapsed',
      'true',
    )
    await outlineResizer.click()
    await expect(outline).toBeVisible()

    await page.locator('#toggle-files').click()
    await expect(files).toBeHidden()
    await filesResizer.click()
    await expect(files).toBeVisible()
  })

  test('renders raw HTML and edits its source without rendering comments', async ({
    page,
  }) => {
    const htmlSource = '<section data-testid="html-preview" onclick="alert(1)"><strong>Rendered HTML</strong></section>\n\n<!-- hidden document comment -->'
    const visibleHtmlSource = '<section data-testid="html-preview" onclick="alert(1)"><strong>Rendered HTML</strong></section>'
    const updatedHtmlSource = '<section data-testid="html-preview"><strong>Updated HTML</strong></section>'
    await editMarkdownSource(page, htmlSource)

    const preview = page.locator('.html-content-preview').first()
    await expect(preview).toContainText('Rendered HTML')
    await expect(page.locator('.ProseMirror')).not.toContainText('hidden document comment')
    await expect(preview.locator('section')).not.toHaveAttribute('onclick', 'alert(1)')
    await expect(preview.locator('script')).toHaveCount(0)

    await preview.click()
    await expect(page.locator('.html-source-editor')).toHaveValue(visibleHtmlSource)
    await page.locator('.html-source-editor').fill(updatedHtmlSource)
    await page.locator('#document-stats').click()
    await expect(page.locator('.html-source-editor')).toHaveCount(0)
    await expect(page.locator('.html-content-preview').first()).toContainText('Updated HTML')
  })

  test('creates and toggles Markdown checklist items', async ({ page }) => {
    const paragraph = page.locator('.ProseMirror p', {
      hasText: 'This document is stored on disk.',
    })
    const checklistButton = page.locator(
      '.rich-content-toolbar--persistent [data-command="task_list"]',
    )
    await paragraph.click()
    await checklistButton.click()

    const checkbox = page.locator(
      '.ProseMirror li[data-item-type="task"] input[type="checkbox"]',
    )
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /\* \[ \] This document is stored on disk\./,
    )

    await checkbox.click()
    await expect(checkbox).toBeChecked()
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /\* \[x\] This document is stored on disk\./,
    )
  })

  test('opens a link in a new tab on Ctrl+click', async ({ page }) => {
    await page.evaluate(() => {
      const state = window as typeof window & { openedLink?: string[] }
      window.open = ((url?: string | URL, target?: string, features?: string) => {
        state.openedLink = [String(url), target ?? '', features ?? '']
        return null
      }) as typeof window.open
    })

    const link = page.locator('.ProseMirror a', { hasText: 'asdf qwer' })
    await link.hover()
    await expect.poll(() => link.evaluate(
      (element) => getComputedStyle(element).cursor,
    )).toBe('text')
    await page.keyboard.down('Control')
    await expect.poll(() => link.evaluate(
      (element) => getComputedStyle(element).cursor,
    )).toBe('pointer')
    await page.keyboard.up('Control')
    await expect.poll(() => link.evaluate(
      (element) => getComputedStyle(element).cursor,
    )).toBe('text')

    await link.click({
      modifiers: ['Control'],
    })
    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { openedLink?: string[] }
    ).openedLink)).toEqual([
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    ])
    await expect(page.locator('#source-dialog')).toBeHidden()
  })

  test('removes a link from only the selected text and accepts an empty URL', async ({
    page,
  }) => {
    const link = page.locator('.ProseMirror a', { hasText: 'asdf qwer' })
    const linkButton = page.locator(
      '.rich-content-toolbar--persistent [data-command="link"]',
    )

    await expect(link).toHaveAttribute('href', 'https://example.com')
    await link.evaluate((element) => {
      const text = element.firstChild
      const editor = element.closest<HTMLElement>('.ProseMirror')
      if (!text || !editor) throw new Error('Could not select the link text.')
      editor.focus()
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, 4)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect(linkButton).toHaveAttribute('aria-pressed', 'true')

    await linkButton.click()
    await expect(page.locator('#source-dialog-title')).toHaveText('Edit link')
    const removeLink = page.locator('#source-dialog-remove')
    await expect(removeLink).toBeVisible()
    await expect(removeLink).toHaveText('Remove link')
    await removeLink.click()

    await expect(page.locator('.ProseMirror a')).toHaveText(' qwer')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /asdf \[qwer\]\(https:\/\/example\.com\)/,
    )

    const remainingLink = page.locator('.ProseMirror a')
    await remainingLink.evaluate((element) => {
      const text = element.firstChild
      const editor = element.closest<HTMLElement>('.ProseMirror')
      if (!text || !editor) throw new Error('Could not select the remaining link.')
      editor.focus()
      const range = document.createRange()
      range.selectNodeContents(text)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect(linkButton).toHaveAttribute('aria-pressed', 'true')

    await linkButton.click()
    await page.locator('#source-dialog-input').fill('')
    await page.locator('#source-dialog-submit').click()
    await expect(page.locator('.ProseMirror a')).toHaveCount(0)
    await expect(page.locator('#debug-markdown-content')).not.toHaveValue(
      /https:\/\/example\.com/,
    )
  })

  test('inserts a standard Markdown image without HTML', async ({ page }) => {
    const imageButton = page.locator(
      '.rich-content-toolbar--persistent [data-command="image"]',
    )

    await imageButton.click()
    await expect(page.locator('#source-dialog-title')).toHaveText('Insert image')
    await expect(page.locator('#source-dialog-label')).toHaveText(
      'Image URL or relative path',
    )
    await page.locator('#source-dialog-input').fill('https://example.com/image.png')
    await page.locator('#source-dialog-submit').click()

    await expect(page.locator('#source-dialog-title')).toHaveText('Describe image')
    await page.locator('#source-dialog-input').fill('Example image')
    await page.locator('#source-dialog-submit').click()

    const image = page.locator('.ProseMirror img:not(.ProseMirror-separator)').last()
    await expect(image).toHaveAttribute('src', 'https://example.com/image.png')
    await expect(image).toHaveAttribute('alt', 'Example image')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /!\[Example image\]\(https:\/\/example\.com\/image\.png\)/,
    )
    await expect(page.locator('#debug-markdown-content')).not.toHaveValue(/<img\b/i)
  })

  test('shows workspace images and inserts them by drag and drop', async ({ page }) => {
    const imageRow = page.locator('.file-row[data-file-kind="image"]', {
      hasText: 'sample.svg',
    })
    await expect(imageRow).toBeVisible()
    await expect(imageRow).toHaveAttribute('draggable', 'true')
    await expect(imageRow.locator('.file-kind-icon')).toHaveCount(1)

    await imageRow.dragTo(page.locator('.ProseMirror'))

    const image = page.locator('.ProseMirror img:not(.ProseMirror-separator)').last()
    await expect(image).toHaveAttribute('alt', 'sample.svg')
    await expect(image).toHaveAttribute('src', /\/__office_md_fs\/asset\?/)
    await expect.poll(() => image.evaluate(
      (element) => (element as HTMLImageElement).naturalWidth,
    )).toBeGreaterThan(0)
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /!\[sample\.svg\]\(sample\.svg\)/,
    )
    await expect(page.locator('#debug-markdown-content')).not.toHaveValue(
      /sample\.svg!\[sample\.svg\]\(sample\.svg\)/,
    )
  })

  test('renders and removes includes, and table toolbar actions mutate the table', async ({
    page,
  }) => {
    const include = page.locator('.markdown-include')
    await expect(include).toContainText('Included section')
    await expect(include).toContainText('This content comes from another file.')

    await include.locator('.markdown-include-remove').click()
    await expect(page.locator('.markdown-include')).toHaveCount(0)
    await expect(page.locator('#debug-markdown-content')).not.toHaveValue(
      /!\[\[included\.md\]\]/,
    )

    const rows = page.locator('.ProseMirror table tr')
    const before = await rows.count()
    await page.locator('.ProseMirror table td').first().click()
    const addRow = page.locator(
      '.table-content-toolbar [data-table-command="add-row-after"]',
    )
    await expect(addRow).toBeVisible()
    expect(await page.locator('.table-content-toolbar').evaluate((element) => ({
      parent: element.parentElement?.tagName,
      position: getComputedStyle(element).position,
    }))).toEqual({ parent: 'BODY', position: 'fixed' })
    await expect(addRow).toHaveAttribute('data-tooltip', 'Insert row after')
    await addRow.hover()
    await expect.poll(() => addRow.evaluate(
      (element) => getComputedStyle(element, '::after').opacity,
    )).toBe('1')
    expect(await addRow.evaluate(
      (element) => getComputedStyle(element, '::after').content,
    )).toContain('Insert row after')
    await addRow.click()
    await expect(rows).toHaveCount(before + 1)
    await expect(page.locator('#debug-markdown-content')).toHaveValue(/Alpha/)
  })

  test('renders CSV-backed Mermaid, applies scoped CSS and Mermaid typography', async ({
    page,
  }) => {
    const preview = page.locator('.mermaid-preview').first()
    const dataSource = page.locator('.mermaid-block').first().locator(
      '.mermaid-data-source',
    )
    await expect(dataSource).toContainText('CSV data source')
    await expect(dataSource.locator('code')).toHaveText('data.csv')
    await expect(preview.locator('svg')).toBeVisible({ timeout: 20_000 })
    await expect(preview).toContainText('Jan')
    await expect(preview).toContainText('120')

    const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const wrapBackground = await page.locator('.editor-wrap').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    await page.locator('[title="Apply theme.css"]').click()
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      bodyBackground,
    )
    expect(await page.locator('.editor-wrap').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).not.toBe(wrapBackground)
    expect(await page.locator('.editor-wrap').evaluate(
      (element) => getComputedStyle(element)
        .getPropertyValue('--page-bg')
        .trim(),
    )).toBe('rgb(31, 32, 33)')
    expect(await page.evaluate(() => getComputedStyle(
      document.querySelector('.ProseMirror') as HTMLElement,
    ).fontFamily)).toContain('Courier New')
    expect(await page.locator('.ProseMirror pre').first().evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).toBe('rgb(20, 30, 40)')
    expect(await preview.locator('svg .nodeLabel').first().evaluate(
      (element) => getComputedStyle(element).fontFamily,
    )).toContain('Courier New')

    const selectors = await page.evaluate(() => {
      const style = document.querySelector<HTMLStyleElement>(
        'style[data-workspace-theme]',
      )
      return style
        ? [...(style.sheet?.cssRules ?? [])]
          .filter((rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE)
          .map((rule) => rule.selectorText)
        : []
    })
    expect(selectors.every((selector) => selector.startsWith('.editor-wrap'))).toBe(true)

    const cssRow = page.locator('.file-row[data-file-kind="css"]', {
      hasText: 'theme.css',
    })
    await expect(cssRow.locator('[data-icon="include"]')).toHaveCount(0)
    const csvRow = page.locator('.file-row[data-file-kind="csv"]', {
      hasText: 'data.csv',
    })
    await expect(csvRow.locator('[data-icon="include"]')).toHaveCount(1)
  })

  test('inserts ordinary and CSV-linked Mermaid and persists source edits', async ({
    page,
  }) => {
    const diagrams = page.locator('.mermaid-block')
    const originalCount = await diagrams.count()
    const diagramButton = page.locator(
      '.rich-content-toolbar--persistent [data-command="diagram"]',
    )

    await diagramButton.click()
    await page.locator('.choice-dialog-option', { hasText: 'Blank Mermaid' }).click()
    await page.locator('#source-dialog-input').fill('flowchart LR\n  Start --> Finish')
    await page.locator('#source-dialog-submit').click()
    await expect(diagrams).toHaveCount(originalCount + 1)
    await expect(diagrams.last().locator('.mermaid-data-source')).toHaveCount(0)
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /```mermaid\nflowchart LR/,
    )

    await diagramButton.click()
    await page.locator('.choice-dialog-option', { hasText: 'data.csv' }).click()
    await page.locator('#source-dialog-input').fill('flowchart LR\n  A2 --> B2')
    await page.locator('#source-dialog-submit').click()
    await expect(diagrams).toHaveCount(originalCount + 2)
    const linkedDiagram = diagrams.filter({
      has: page.locator('.mermaid-data-source'),
    }).last()
    await expect(linkedDiagram.locator('.mermaid-data-source')).toContainText('data.csv')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /```mermaid\(data\.csv\)/,
    )

    const newest = linkedDiagram.locator('.mermaid-preview')
    await expect(newest.locator('svg')).toBeVisible({ timeout: 20_000 })
    await newest.click()
    const sourceEditor = page.locator('.mermaid-source-editor')
    await sourceEditor.fill('flowchart LR\n  A2 --> C2')
    await sourceEditor.press('Control+Enter')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(/A2 --> C2/)
  })

  test('edits a code block programming language', async ({ page }) => {
    const codeBlock = page.locator('.code-block').first()
    const language = codeBlock.getByLabel('Programming language')
    await expect(language).toHaveValue('javascript')

    await language.fill('python')
    await language.press('Enter')

    await expect(language).toHaveValue('python')
    await expect(codeBlock.locator('pre')).toHaveAttribute('data-language', 'python')
    await expect(page.locator('#debug-markdown-content')).toHaveValue(
      /```python\nconst themed = true/,
    )
  })

  test('page settings drive layout and HTML/portable exports contain materialized output', async ({
    page,
  }) => {
    await expect(page.locator('.page-layout-gap[data-page-break="forced"]')).toHaveCount(1, {
      timeout: 20_000,
    })
    await expect(page.locator('#page-count')).toContainText('2 pages')

    await page.locator('#layout-mode').selectOption('continuous')
    await expect(page.locator('#page-count')).toBeHidden()
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'data-page-mode',
      'continuous',
    )
    await expect(page.locator('.page-layout-gap')).toHaveCount(0)
    await expect.poll(() => page.locator('.ProseMirror').evaluate(
      (element) => element.style.getPropertyValue('--page-width'),
    )).toBe('')

    await page.locator('#layout-mode').selectOption('document')
    await expect(page.locator('#page-count')).toBeVisible()
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'data-page-mode',
      'document',
    )

    await page.locator('#page-format').selectOption('a4-landscape')
    await expect.poll(() => page.locator('.ProseMirror').evaluate(
      (element) => getComputedStyle(element).getPropertyValue('--page-width').trim(),
    )).toBe('1123px')
    await expect.poll(() => page.locator('.ProseMirror').evaluate(
      (element) => getComputedStyle(element).getPropertyValue('--page-height').trim(),
    )).toBe('794px')

    await page.locator('#layout-mode').selectOption('presentation')
    await page.locator('#page-format').selectOption('a4-portrait')
    await expect(page.locator('.ProseMirror')).toHaveAttribute(
      'data-page-mode',
      'presentation',
    )
    await expect.poll(() => page.locator('.ProseMirror').evaluate(
      (element) => getComputedStyle(element).getPropertyValue('--page-height').trim(),
    )).toBe('1123px')

    await page.locator('#layout-mode').selectOption('document')
    const htmlDownloadPromise = page.waitForEvent('download')
    await page.locator('.editor-card [data-file-export]').click()
    await page.locator('.choice-dialog-option', { hasText: 'HTML' }).click()
    const htmlDownload = await htmlDownloadPromise
    const html = await readFile(await htmlDownload.path() as string, 'utf8')
    const exportedPageCount = html.match(/class="export-page"/g)?.length ?? 0
    expect(exportedPageCount).toBeGreaterThanOrEqual(2)
    await expect.poll(async () => Number.parseInt(
      await page.locator('#page-count').textContent() ?? '0',
      10,
    )).toBe(exportedPageCount)
    expect(html).toContain('@page')
    expect(html).toContain('This content comes from another file.')
    expect(html).not.toMatch(/class="[^"]*\bmarkdown-include-header\b/)

    const markdownDownloadPromise = page.waitForEvent('download')
    await page.locator('.editor-card [data-file-export]').click()
    await page.locator('.choice-dialog-option', { hasText: 'Portable Markdown' }).click()
    const markdownDownload = await markdownDownloadPromise
    const portable = await readFile(await markdownDownload.path() as string, 'utf8')
    expect(portable).toContain('This content comes from another file.')
    expect(portable).not.toContain('![[included.md]]')
    expect(portable).toContain('A2["Jan"] --> B2["120"]')
    expect(portable).not.toContain('mermaid(data.csv)')
  })

  test('debug source collapses, rerenders edits, and compact toolbars do not overflow', async ({
    page,
  }) => {
    const debug = page.locator('#debug-markdown-view')
    await debug.locator('summary').click()
    await expect(debug).not.toHaveAttribute('open', '')
    await debug.locator('summary').click()
    await expect(debug).toHaveAttribute('open', '')

    await editMarkdownSource(page, '# Re-rendered from source\n\nNew body.')
    await expect(page.locator('.ProseMirror h1')).toHaveText('Re-rendered from source')

    await page.setViewportSize({ width: 760, height: 900 })
    const dimensions = await page.evaluate(() => {
      const top = document.querySelector('.editor-toolbar') as HTMLElement
      const rich = document.querySelector(
        '.rich-content-toolbar--persistent',
      ) as HTMLElement
      const outside = (container: HTMLElement, selector: string) => {
        const bounds = container.getBoundingClientRect()
        return [...container.querySelectorAll<HTMLElement>(selector)].some((item) => {
          const itemBounds = item.getBoundingClientRect()
          return itemBounds.left < bounds.left - 1 || itemBounds.right > bounds.right + 1
        })
      }
      return {
        topOverflow: outside(top, 'button, select'),
        richOverflow: outside(rich, 'button'),
        hostOverflow: getComputedStyle(rich.parentElement as HTMLElement).overflowX,
        sigma: document.querySelector(
          '[data-command="formula"] path',
        )?.getAttribute('d'),
      }
    })
    expect(dimensions.topOverflow).toBe(false)
    expect(dimensions.richOverflow).toBe(false)
    expect(dimensions.hostOverflow).not.toBe('auto')
    expect(dimensions.hostOverflow).not.toBe('scroll')
    expect(dimensions.sigma).toBe('M17 5H8l5 7-5 7h9')
    await expect(page.locator('#rename-document')).toBeEnabled()
  })
})
