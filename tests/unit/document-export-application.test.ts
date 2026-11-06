import { describe, expect, it } from 'vitest'
import { createDocumentExportApplication } from '../../src/document-export-application'

describe('shared document export application', () => {
  it('exports current unsaved documents and evaluated CSV includes through one pipeline', () => {
    const files = [{ name: 'notes.md', markdown: '# Unsaved\n\n![[data.csv]]' }, { name: 'data.csv', markdown: 'value\n=1+1' }]
    const exports = createDocumentExportApplication({ files: () => files, csvSource: () => 'value\n2' })
    expect(exports.portableMarkdown('notes.md')).toBe('# Unsaved\n\n| value |\n| --- |\n| 2 |')
    files[0].markdown = '# Latest'
    expect(exports.portableMarkdown('notes.md')).toBe('# Latest')
  })
})
