import { describe, expect, it } from 'vitest'
import {
  csvToMarkdownTable,
  expandCsvReferences,
  normalizeCsvRows,
  parseCsv,
  serializeCsv,
} from '../../src/csv-utils'

describe('CSV parsing and serialization', () => {
  it('parses quoted commas, escaped quotes, multiline fields, and CRLF', () => {
    const source = 'name,note\r\nAlice,"one,two"\r\nBob,"line 1\nline 2"\r\nEve,"say ""hello"""\r\n'
    expect(parseCsv(source)).toEqual([
      ['name', 'note'],
      ['Alice', 'one,two'],
      ['Bob', 'line 1\nline 2'],
      ['Eve', 'say "hello"'],
    ])
  })

  it('preserves trailing empty cells but removes wholly empty trailing rows', () => {
    expect(parseCsv('a,b,\n1,2,\n,,\n')).toEqual([
      ['a', 'b', ''],
      ['1', '2', ''],
    ])
  })

  it('normalizes ragged and empty data into a rectangular sheet', () => {
    expect(normalizeCsvRows([['a'], ['b', 'c']])).toEqual([
      ['a', ''],
      ['b', 'c'],
    ])
    expect(normalizeCsvRows([])).toEqual([['']])
  })

  it('round-trips values that require CSV quoting', () => {
    const rows = [
      ['plain', 'comma,value', 'quote " value'],
      ['multiline', 'first\nsecond', ''],
    ]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })

  it('creates a Markdown table and escapes pipes and line breaks', () => {
    expect(csvToMarkdownTable('Name,Notes\nA|B,"first\nsecond"')).toBe([
      '| Name | Notes |',
      '| --- | --- |',
      '| A\\|B | first\\\\second |',
    ].join('\n'))
  })
})

describe('CSV-backed Mermaid expansion', () => {
  const csv = [
    'month,Visitors,Signups',
    'Jan,120,22',
    'Feb,148,28',
    'Mar,176,35',
  ].join('\n')

  it('expands individual cells without replacing the reference itself', () => {
    expect(expandCsvReferences('flowchart LR\n  A2 --> B2', csv)).toContain(
      'A2["Jan"] --> B2["120"]',
    )
  })

  it('escapes Mermaid labels and leaves missing or empty cells untouched', () => {
    const labels = 'from,to\n"Say ""go""",Done\n,Later'
    const expanded = expandCsvReferences('flowchart LR\n A2 --> B2\n A3 --> B3\n D9', labels)
    expect(expanded).toContain('A2["Say #quot;go#quot;"] --> B2["Done"]')
    expect(expanded).toContain('A3 --> B3["Later"]')
    expect(expanded).toContain('D9')
  })

  it('expands x-axis ranges as quoted categories', () => {
    const result = expandCsvReferences('xychart-beta\n  x-axis [A2:A4]', csv)
    expect(result).toContain('x-axis ["Jan", "Feb", "Mar"]')
  })

  it('labels only the first value of each numeric series', () => {
    const source = [
      'xychart-beta',
      '  %% Website traffic',
      '  line [B2:B4]',
      '  bar [C2:C4]',
    ].join('\n')
    const result = expandCsvReferences(source, csv)
    expect(result).toContain('line [120 "Website traffic", 148, 176]')
    expect(result).toContain('bar [22 "Signups", 28, 35]')
    expect(result.match(/Website traffic/g)).toHaveLength(2)
    expect(result.match(/"Signups"/g)).toHaveLength(1)
  })

  it('derives a label for a horizontal row range from its preceding cell', () => {
    const result = expandCsvReferences(
      'xychart-beta\n  line [B2:D2]',
      'name,Q1,Q2,Q3\nRevenue,10,20,30',
    )
    expect(result).toContain('line [10 "Revenue", 20, 30]')
  })

  it('normalizes blank numeric range entries to zero', () => {
    const result = expandCsvReferences(
      'xychart-beta\n  line [B2:B4]',
      'name,value\na,1\nb,\nc,3',
    )
    expect(result).toContain('line [1 "value", 0, 3]')
  })
})
