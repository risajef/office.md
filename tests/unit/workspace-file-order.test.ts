import { describe, expect, it } from 'vitest'
import {
  firstVisibleEditableWorkspaceFile,
  workspaceFileViewOrder,
} from '../../src/workspace-file-order'

describe('workspace file view order', () => {
  it('orders root files before nested folders, matching the visible file tree', () => {
    const files = [
      { name: 'z.csv', markdown: '' },
      { name: 'a-folder/note.md', markdown: '' },
      { name: 'b-folder/table.csv', markdown: '' },
      { name: 'a.md', markdown: '' },
    ]
    const directories = ['b-folder', 'a-folder']

    expect(workspaceFileViewOrder(files, directories)).toEqual([
      'a.md',
      'z.csv',
      'a-folder/note.md',
      'b-folder/table.csv',
    ])
    expect(firstVisibleEditableWorkspaceFile(files, directories)).toBe('a.md')
  })

  it('returns no active document when the folder has no visible Markdown or CSV file', () => {
    expect(firstVisibleEditableWorkspaceFile([
      { name: 'theme.css', markdown: '' },
      { name: 'image.png', markdown: '' },
      { name: '.hidden.md', markdown: '' },
      { name: 'notes.txt', markdown: '' },
    ], [])).toBeUndefined()
  })
})
