import { describe, expect, it } from 'vitest'
import { createPortableMarkdown } from '../../src/portable-markdown'

const create = (
  markdown: string,
  includes: Record<string, string> = {},
  csvFiles: Record<string, string> = {},
) => createPortableMarkdown(markdown, {
  resolveInclude: (name) => includes[name],
  resolveCsv: (name) => csvFiles[name],
})

describe('portable Markdown', () => {
  it('recursively materializes Markdown includes', () => {
    const result = create(
      '# Main\n\n![[section.md]]',
      {
        'section.md': '## Section\n\n![[detail.md]]',
        'detail.md': 'Final detail.',
      },
    )
    expect(result).toBe('# Main\n\n## Section\n\nFinal detail.')
  })

  it('does not interpret include syntax inside fenced code', () => {
    const source = '```md\n![[section.md]]\n```\n\n![[section.md]]'
    expect(create(source, { 'section.md': 'Included' })).toBe(
      '```md\n![[section.md]]\n```\n\nIncluded',
    )
  })

  it('preserves unresolved and cyclic includes instead of recursing forever', () => {
    expect(create('![[missing.md]]')).toBe('![[missing.md]]')
    expect(create('![[a.md]]', {
      'a.md': 'A\n![[b.md]]',
      'b.md': 'B\n![[a.md]]',
    })).toBe('A\nB\n![[a.md]]')
  })

  it('materializes CSV-backed Mermaid while retaining native Mermaid syntax', () => {
    const markdown = [
      '```mermaid(data.csv)',
      'flowchart LR',
      '  A2 --> B2',
      '```',
    ].join('\n')
    const result = create(markdown, {}, { 'data.csv': 'from,to\nIdea,Write' })
    expect(result).toBe([
      '```mermaid',
      'flowchart LR',
      '  A2["Idea"] --> B2["Write"]',
      '```',
    ].join('\n'))
  })

  it('supports tilde fences and CSV xychart ranges', () => {
    const markdown = [
      '~~~mermaid(plot.csv)',
      'xychart-beta',
      '  x-axis [A2:A3]',
      '  line [B2:B3]',
      '~~~',
    ].join('\n')
    const result = create(markdown, {}, {
      'plot.csv': 'month,Visitors\nJan,120\nFeb,148',
    })
    expect(result).toContain('~~~mermaid')
    expect(result).toContain('x-axis ["Jan", "Feb"]')
    expect(result).toContain('line [120 "Visitors", 148]')
  })

  it('leaves missing and unclosed CSV Mermaid fences unchanged', () => {
    const missing = '```mermaid(missing.csv)\nflowchart LR\n A --> B\n```'
    const unclosed = '```mermaid(data.csv)\nflowchart LR\n A2 --> B2'
    expect(create(missing)).toBe(missing)
    expect(create(unclosed, {}, { 'data.csv': 'a,b\nA,B' })).toBe(unclosed)
  })

  it('uses evaluated CSV supplied by the resolver', () => {
    const result = create(
      '```mermaid(data.csv)\nflowchart LR\n A2 --> B2\n```',
      {},
      { 'data.csv': 'formula,result\n2 + 2,4' },
    )
    expect(result).toContain('B2["4"]')
    expect(result).not.toContain('B2["=')
  })
})
