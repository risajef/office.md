import { describe, expect, it } from 'vitest'
import { createStyleFolderApplication } from '../../src/style-folder-application'
import { createWorkspaceApplication } from '../../src/workspace-application'
import { createMemoryStyleFolderPort } from '../../src/style-folder-port'
import { createMemoryWorkspacePort } from '../../src/workspace-port'

describe('independent style-folder application', () => {
  it('keeps external styles out of workspace files, includes, and mutations', async () => {
    const workspace = createWorkspaceApplication(createMemoryWorkspacePort({
      path: '/tmp/document-project',
      name: 'document-project',
      files: [{ name: 'notes.md', markdown: '# Notes\n' }],
    }))
    const styles = createStyleFolderApplication(createMemoryStyleFolderPort({
      path: '/tmp/style-library',
      name: 'style-library',
      files: [{ name: 'library.css', contents: '.ProseMirror { color: red; }' }],
    }))

    await workspace.open()
    await styles.open()

    expect(workspace.file('library.css')).toBeUndefined()
    expect(styles.file('library.css')?.name).toBe('library.css')
    expect(workspace.createPortableMarkdown('notes.md')).toBe('# Notes\n')

    await workspace.saveFile('notes.md', '# Changed\n')

    expect(await styles.readFile('library.css')).toBe('.ProseMirror { color: red; }')
  })
})
