const cellReferencePattern = /\b([A-Z]{1,3})(\d+)\b(?!\s*\[)/g

const columnToIndex = (column: string) => {
  let index = 0
  for (const character of column) {
    index = index * 26 + character.charCodeAt(0) - 64
  }
  return index - 1
}

const escapeMarkdownCell = (value: string) =>
  value.replace(/\|/g, '\\|').replace(/\r?\n/g, '\\\\')

const escapeMermaidLabel = (value: string) =>
  value.replace(/"/g, '#quot;').replace(/\r?\n/g, ' ')

/** Parse a CSV string while preserving quoted commas, quotes, and newlines. */
export const parseCsv = (source: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        value += character
      }
      continue
    }

    if (character === '"' && value.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(value)
      value = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') index += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (value.length || row.length || source.endsWith(',')) {
    row.push(value)
    rows.push(row)
  }

  while (rows.length && rows.at(-1)?.every((cell) => cell === '')) rows.pop()
  return rows
}

export const normalizeCsvRows = (rows: string[][]) => {
  const width = Math.max(1, ...rows.map((row) => row.length))
  const normalized = rows.length ? rows : [['']]
  return normalized.map((row) => [...row, ...Array(width - row.length).fill('')])
}

export const serializeCsv = (rows: string[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')

export const csvToMarkdownTable = (source: string) => {
  const rows = normalizeCsvRows(parseCsv(source))
  const [header = [], ...body] = rows
  const headerLine = `| ${header.map(escapeMarkdownCell).join(' | ')} |`
  const dividerLine = `| ${header.map(() => '---').join(' | ')} |`
  const bodyLines = body.map(
    (row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`,
  )
  return [headerLine, dividerLine, ...bodyLines].join('\n')
}

const getCsvCell = (rows: string[][], reference: string) => {
  const match = reference.match(/^([A-Z]{1,3})(\d+)$/)
  if (!match) return undefined
  const row = rows[Number(match[2]) - 1]
  return row?.[columnToIndex(match[1])] ?? undefined
}

type CsvRange = {
  startColumn: number
  startRow: number
  endColumn: number
  endRow: number
}

const parseCsvRange = (value: string): CsvRange | undefined => {
  const match = value.trim().toUpperCase().match(
    /^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/,
  )
  if (!match) return undefined

  const firstColumn = columnToIndex(match[1])
  const firstRow = Number(match[2]) - 1
  const lastColumn = columnToIndex(match[3] ?? match[1])
  const lastRow = Number(match[4] ?? match[2]) - 1
  if (
    firstColumn < 0 ||
    lastColumn < 0 ||
    firstRow < 0 ||
    lastRow < 0
  ) return undefined

  return {
    startColumn: Math.min(firstColumn, lastColumn),
    startRow: Math.min(firstRow, lastRow),
    endColumn: Math.max(firstColumn, lastColumn),
    endRow: Math.max(firstRow, lastRow),
  }
}

const getCsvRange = (rows: string[][], reference: string) => {
  const range = parseCsvRange(reference)
  if (!range) return undefined

  const values: string[] = []
  for (let row = range.startRow; row <= range.endRow; row += 1) {
    for (
      let column = range.startColumn;
      column <= range.endColumn;
      column += 1
    ) {
      values.push(rows[row]?.[column] ?? '')
    }
  }
  return values
}

const csvRangePattern = /\b([A-Z]{1,3}\d+:[A-Z]{1,3}\d+)\b/g

const lineAtOffset = (source: string, offset: number) => {
  const start = source.lastIndexOf('\n', offset - 1) + 1
  const end = source.indexOf('\n', offset)
  return source.slice(start, end < 0 ? source.length : end)
}

const seriesLabelAtOffset = (source: string, offset: number) => {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1
  const before = source.slice(0, lineStart)
  const match = before.match(/(?:^|\n)\s*%%\s*(.+?)\s*$/)
  return match?.[1]?.trim()
}

const csvSeriesLabel = (rows: string[][], reference: string) => {
  const range = parseCsvRange(reference)
  if (!range) return undefined

  if (range.startColumn === range.endColumn && range.startRow > 0) {
    return rows[range.startRow - 1]?.[range.startColumn]?.trim() || undefined
  }
  if (range.startRow === range.endRow && range.startColumn > 0) {
    return rows[range.startRow]?.[range.startColumn - 1]?.trim() || undefined
  }
  return undefined
}

const escapeMermaidAxisLabel = (value: string) =>
  `"${value.replace(/"/g, '#quot;').replace(/\r?\n/g, ' ')}"`

/** Expand a CSV row or column range inside Mermaid xychart data. */
const expandCsvRanges = (source: string, csv: string) => {
  const rows = normalizeCsvRows(parseCsv(csv))
  return source.replace(csvRangePattern, (reference, range: string, offset: number) => {
    const values = getCsvRange(rows, range)
    if (!values) return reference
    const line = lineAtOffset(source, offset)
    const numeric = /^\s*(?:line|bar)\b/i.test(line)
    const label = numeric
      ? seriesLabelAtOffset(source, offset) ?? csvSeriesLabel(rows, range)
      : undefined
    return values
      .map((value, index) => {
        if (!numeric) return escapeMermaidAxisLabel(value)
        const number = value.trim() || '0'
        return label && index === 0
          ? `${number} ${escapeMermaidAxisLabel(label)}`
          : number
      })
      .join(', ')
  })
}

/** Expand spreadsheet references and xychart ranges from a linked CSV. */
export const expandCsvReferences = (source: string, csv: string) => {
  const expanded = expandCsvRanges(source, csv)
  const rows = normalizeCsvRows(parseCsv(csv))
  return expanded.replace(cellReferencePattern, (reference, column, row) => {
    const value = getCsvCell(rows, `${column}${row}`)
    return value === undefined || value === ''
      ? reference
      : `${reference}["${escapeMermaidLabel(value)}"]`
  })
}
