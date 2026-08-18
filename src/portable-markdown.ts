import { expandCsvReferences } from './csv-utils'

type PortableMarkdownResolvers = {
  resolveInclude: (fileName: string) => string | undefined
  resolveCsv: (fileName: string) => string | undefined
}

const fenceStartPattern = /^\s{0,3}(`{3,}|~{3,})(.*)$/
const includePattern = /^\s*!\[\[([^\]\n]+)\]\]\s*$/

const expandIncludes = (
  markdown: string,
  resolveInclude: PortableMarkdownResolvers['resolveInclude'],
  ancestors: ReadonlySet<string> = new Set(),
): string => {
  const lines = markdown.split(/\r?\n/)
  const output: string[] = []
  let fence: { marker: string; size: number } | undefined

  for (const line of lines) {
    const fenceMatch = line.match(fenceStartPattern)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (!fence) {
        fence = { marker, size: fenceMatch[1].length }
      } else if (
        marker === fence.marker &&
        fenceMatch[1].length >= fence.size &&
        !fenceMatch[2].trim()
      ) {
        fence = undefined
      }
      output.push(line)
      continue
    }

    const include = !fence ? line.match(includePattern)?.[1]?.trim() : undefined
    if (!include || ancestors.has(include)) {
      output.push(line)
      continue
    }

    const included = resolveInclude(include)
    if (included === undefined) {
      output.push(line)
      continue
    }
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(include)
    output.push(expandIncludes(included, resolveInclude, nextAncestors))
  }

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
) => materializeCsvMermaid(
  expandIncludes(markdown, resolvers.resolveInclude),
  resolvers.resolveCsv,
)
