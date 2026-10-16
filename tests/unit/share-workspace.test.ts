import { describe, expect, it } from 'vitest'
import {
  collectWorkspaceSharePayload,
  createCurrentFileSharePayload,
} from '../../src/share-workspace'

describe('workspace share snapshot preparation', () => {
  it('uses the active Markdown edit in portable form and retains CSV formulas', () => {
    const markdown = createCurrentFileSharePayload({
      id: 'edited-markdown',
      file: { name: 'docs/report.md', kind: 'markdown', markdown: '# Unsaved edit\n![[details.md]]' },
      portableMarkdown: '# Unsaved edit\nIncluded section',
    })
    const csv = createCurrentFileSharePayload({
      id: 'edited-csv',
      file: { name: 'metrics.csv', kind: 'csv', markdown: 'value\n=B2*2' },
    })

    expect(markdown.files[0].path).toBe('report.md')
    expect(markdown.files[0].content).toBe('# Unsaved edit\nIncluded section')
    expect(csv.files[0].content).toBe('value\n=B2*2')
  })

  it('collects visible supported files, preserves relative paths, and excludes hidden or inaccessible files', async () => {
    const readImage = async (name: string) => name === 'images/ok.png'
      ? Uint8Array.from([0, 1, 2, 255])
      : undefined
    const payload = await collectWorkspaceSharePayload({
      id: 'workspace-current',
      name: 'project',
      files: [
        { name: 'docs/report.md', kind: 'markdown', markdown: '![[../data.csv]]' },
        { name: 'data.csv', kind: 'csv', markdown: 'result\n=B2*2' },
        { name: 'theme.css', kind: 'css', markdown: 'body {}' },
        { name: 'images/ok.png', kind: 'image', markdown: '' },
        { name: '.hidden.md', kind: 'markdown', markdown: 'hidden' },
        { name: 'node_modules/notes.md', kind: 'markdown', markdown: 'generated parent' },
        { name: 'notes.txt', markdown: 'unsupported' },
        { name: 'images/missing.png', kind: 'image', markdown: '' },
      ],
      readImage,
    })

    expect(payload.files.map((file) => file.path)).toEqual([
      'data.csv', 'docs/report.md', 'images/ok.png', 'theme.css',
    ])
    expect(payload.files.find((file) => file.path === 'data.csv')?.content).toBe('result\n=B2*2')
    expect(payload.files.find((file) => file.path === 'docs/report.md')?.content).toBe('![[../data.csv]]')
    expect(payload.files.find((file) => file.path === 'images/ok.png')?.content).toBe('AAEC/w==')
  })
})
