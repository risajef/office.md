import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const representativeDocument = [
  '# Project document',
  '',
  'This document is stored on disk.',
  '',
  '![[included.md]]',
  '',
  '```mermaid(metrics.csv)',
  'flowchart LR',
  '  A2 --> B2',
  '```',
  '',
].join('\n')

export const representativeIncludedMarkdown = `## Included section

This content comes from another file.
`

export const representativeCsvSource = `label,value,total
Idea,2,=B2*2
Write,3,=B3*2
`

export const representativePortableMarkdown = [
  '# Project document',
  '',
  'This document is stored on disk.',
  '',
  '## Included section',
  '',
  'This content comes from another file.',
  '',
  '',
  '```mermaid',
  'flowchart LR',
  '  A2["Idea"] --> B2["2"]',
  '```',
  '',
].join('\n')

export const writeRepresentativeWorkspace = async (root: string) => {
  await writeFile(path.join(root, 'document.md'), representativeDocument, 'utf8')
  await writeFile(
    path.join(root, 'included.md'),
    representativeIncludedMarkdown,
    'utf8',
  )
  await writeFile(path.join(root, 'metrics.csv'), representativeCsvSource, 'utf8')
  await mkdir(path.join(root, 'empty-folder'))
}
