const cellReferencePattern = /\b([A-Z]{1,3})(\d+)\b(?!\s*\[)/g

const columnToIndex = (column: string) => {
  let index = 0
  for (const character of column) {
    index = index * 26 + character.charCodeAt(0) - 64
  }
  return index - 1
}

const escapeMarkdownCell = (value: string) =>
  value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')

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

/** Turn bare spreadsheet references such as A2 into labelled Mermaid nodes. */
export const expandCsvReferences = (source: string, csv: string) => {
  const rows = normalizeCsvRows(parseCsv(csv))
  return source.replace(cellReferencePattern, (reference, column, row) => {
    const value = getCsvCell(rows, `${column}${row}`)
    return value === undefined || value === ''
      ? reference
      : `${reference}["${escapeMermaidLabel(value)}"]`
  })
}

const mermaidId = (prefix: string, index: number) => `${prefix}${index + 1}`

/** Convert the first two columns of a CSV into a portable Mermaid flowchart. */
export const csvToMermaidFlowchart = (source: string) => {
  const rows = normalizeCsvRows(parseCsv(source))
  const [, ...body] = rows
  const values = new Map<string, string>()
  const edges: Array<[string, string]> = []

  const getId = (value: string) => {
    const existing = values.get(value)
    if (existing) return existing
    const id = `csvNode${values.size + 1}`
    values.set(value, id)
    return id
  }

  body.forEach((row, index) => {
    const left = row[0]?.trim() ?? ''
    const right = row[1]?.trim() ?? ''
    if (left && right) edges.push([getId(left), getId(right)])
    else if (left) getId(left)
    else if (right) getId(right)
    if (!left && !right && index === 0) return
  })

  const labels = [...values.entries()].map(
    ([value, id]) => `  ${id}["${escapeMermaidLabel(value)}"]`,
  )
  const links = edges.map(([left, right]) => `  ${left} --> ${right}`)
  return ['flowchart LR', ...labels, ...links].join('\n')
}
