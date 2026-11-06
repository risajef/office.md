import { expandCsvReferences } from './csv-utils'

type PortableMarkdownResolvers = {
  resolveInclude: (fileName: string) => string | undefined
  resolveCsv: (fileName: string) => string | undefined
}

const fenceStartPattern = /^\s{0,3}(`{3,}|~{3,})(.*)$/
const includePattern = /^\s*!\[\[([^\]\n]+)\]\]\s*$/

type PortableMarkdownLimits = { maxBytes?: number; maxDepth?: number }
const utf8 = new TextEncoder()
const expandIncludes = (
  markdown: string,
  resolveInclude: PortableMarkdownResolvers['resolveInclude'],
  options: PortableMarkdownLimits,
): string => {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024
  const maxDepth = options.maxDepth ?? 32
  const output: string[] = []
  let total = 0
  const append = (line: string) => {
    total += utf8.encode(line).byteLength + (output.length ? 1 : 0)
    if (total > maxBytes) throw new Error(`Portable Markdown exceeds the ${maxBytes} byte output limit.`)
    output.push(line)
  }
  const visit = (source: string, ancestors: ReadonlySet<string>, depth: number): void => {
    let fence: { marker: string; size: number } | undefined
    for (const line of source.split(/\r?\n/)) {
      const fenceMatch = line.match(fenceStartPattern)
      if (fenceMatch) {
        const marker = fenceMatch[1][0]
        if (!fence) fence = { marker, size: fenceMatch[1].length }
        else if (marker === fence.marker && fenceMatch[1].length >= fence.size && !fenceMatch[2].trim()) fence = undefined
        append(line)
        continue
      }
      const include = !fence ? line.match(includePattern)?.[1]?.trim() : undefined
      if (!include || ancestors.has(include)) { append(line); continue }
      const included = resolveInclude(include)
      if (included === undefined) { append(line); continue }
      if (depth >= maxDepth) throw new Error(`Portable Markdown exceeds the ${maxDepth} include depth limit.`)
      visit(included, new Set([...ancestors, include]), depth + 1)
    }
  }
  visit(markdown, new Set(), 0)
  return output.join('\n')
}

const materializeCsvMermaid = (
  markdown: string,
  resolveCsv: PortableMarkdownResolvers['resolveCsv'],
) => {
  const lines = markdown.split(/\r?\n/)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const opener = line.match(
      /^(\s{0,3})(`{3,}|~{3,})mermaid\(([^)]+)\)\s*$/i,
    )
    if (!opener) {
      output.push(line)
      continue
    }

    const marker = opener[2][0]
    const minimumSize = opener[2].length
    let closingIndex = index + 1
    while (closingIndex < lines.length) {
      const closing = lines[closingIndex].match(/^\s{0,3}(`{3,}|~{3,})\s*$/)
      if (
        closing &&
        closing[1][0] === marker &&
        closing[1].length >= minimumSize
      ) break
      closingIndex += 1
    }
    if (closingIndex >= lines.length) {
      output.push(line)
      continue
    }

    const csv = resolveCsv(opener[3].trim())
    if (csv === undefined) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const source = lines.slice(index + 1, closingIndex).join('\n')
    output.push(
      `${opener[1]}${opener[2]}mermaid`,
      ...expandCsvReferences(source, csv).split('\n'),
      lines[closingIndex],
    )
    index = closingIndex
  }

  return output.join('\n')
}

/** Build portable Markdown by inlining includes and linked CSV values. */
export const createPortableMarkdown = (
  markdown: string,
  resolvers: PortableMarkdownResolvers,
  limits: PortableMarkdownLimits = {},
) => {
  const result = materializeCsvMermaid(expandIncludes(markdown, resolvers.resolveInclude, limits), resolvers.resolveCsv)
  const maxBytes = limits.maxBytes ?? 10 * 1024 * 1024
  if (utf8.encode(result).byteLength > maxBytes) throw new Error(`Portable Markdown exceeds the ${maxBytes} byte output limit.`)
  return result
}
