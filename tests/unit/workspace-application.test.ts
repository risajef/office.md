import { describe, expect, it } from 'vitest'
import { createWorkspaceApplication } from '../../src/workspace-application'
import { createMemoryWorkspacePort } from '../../src/workspace-port'
import {
  representativeCsvSource,
  representativeDocument,
  representativeIncludedMarkdown,
  representativePortableMarkdown,
} from '../fixtures/representative-workspace'

const createApplication = () => createWorkspaceApplication(
  createMemoryWorkspacePort({
    path: '/tmp/office-md-project',
    name: 'office-md-project',
    files: [
      {
        name: 'report.md',
        markdown: representativeDocument,
      },
      {
        name: 'included.md',
        markdown: representativeIncludedMarkdown,
      },
      {
        name: 'metrics.csv',
        markdown: representativeCsvSource,
      },
    ],
  }),
)

describe('WorkspaceApplication', () => {
  it('opens, saves, and reloads source without evaluating away CSV formulas', async () => {
    const application = createApplication()

    const opened = await application.open()
    expect(opened?.workspace.name).toBe('office-md-project')
    expect(application.file('metrics.csv')?.markdown).toContain('=B2*2')
    const changedCsv = 'label,value,total\nIdea,8,=B2*2\nWrite,13,=B3*2\n'
    await application.saveFile('metrics.csv', changedCsv)
    expect(application.file('metrics.csv')?.markdown).toBe(changedCsv)

    const reloaded = await application.reload()
    expect(reloaded.files.find((file) => file.name === 'metrics.csv')?.markdown)
      .toBe(changedCsv)
  })

  it('filters Open File to Markdown and CSV and opens a nested file from its parent workspace', async () => {
    const application = createWorkspaceApplication(createMemoryWorkspacePort({
      path: '/tmp/office-md-project',
      name: 'office-md-project',
      files: [
        { name: 'document.md', markdown: '# Root\n' },
        { name: 'nested/table.csv', markdown: 'name,value\nAlpha,1\n' },
        { name: 'nested/theme.css', markdown: 'body {}' },
        { name: 'notes.txt', markdown: 'unsupported' },
      ],
    }))

    const selection = await application.openFile(async (files) => {
      expect(files.map((file) => file.name)).toEqual([
        'document.md',
        'nested/table.csv',
      ])
      return 'nested/table.csv'
    })

    expect(selection?.fileName).toBe('table.csv')
    expect(selection?.snapshot.workspace).toMatchObject({
      name: 'nested',
      path: '/tmp/office-md-project/nested',
    })
    expect(application.state.workspace?.path).toBe('/tmp/office-md-project/nested')
    expect(application.file('table.csv')?.markdown).toContain('Alpha,1')
    expect(application.file('theme.css')?.markdown).toBe('body {}')
  })

  it('resolves includes and creates an export through the public application seam', async () => {
    const application = createApplication()
    await application.open()

    expect(application.createPortableMarkdown('report.md')).toBe(
      representativePortableMarkdown,
    )

    const editorRoot = document.createElement('div')
    editorRoot.id = 'editor'
    editorRoot.innerHTML = '<div class="milkdown"><div class="ProseMirror"><h1>Report</h1></div></div>'
    const html = application.createDocumentExportHtml('report.md', editorRoot, {
      width: 794,
      height: 1123,
      margin: 56,
      gap: 28,
      pageCount: 1,
    })
    expect(html).toContain('<title>report.md</title>')
    expect(html).toContain('class="export-page"')
  })

  it('keeps unsafe application mutations behind the workspace safety boundary', async () => {
    const application = createApplication()
    await application.open()

    await expect(application.saveFile('../outside.md', 'unsafe'))
      .rejects.toThrow('invalid')
    await expect(application.renameFile('report.md', '.hidden.md'))
      .rejects.toThrow('invalid')
    await expect(application.deleteDirectory('missing'))
      .rejects.toThrow('not found')
  })
})
