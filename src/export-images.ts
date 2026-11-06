/** Package session-bound images; external network images retain their URLs. */
export const materializeExportImages = async (
  root: HTMLElement,
  resolve?: (source: string) => Promise<string | undefined>,
) => {
  const clone = root.cloneNode(true) as HTMLElement
  let total = 0
  const encoded = new Map<string, string>()
  for (const image of clone.querySelectorAll<HTMLImageElement>('img[src]')) {
    const original = image.getAttribute('src') ?? ''
    if (!original || /^data:|^https?:|^\/\//i.test(original)) {
      // Absolute same-origin bridge URLs still require packaging below.
      if (!original.includes('/__office_md_fs/asset?')) continue
    }
    let source = original
    if (!source.startsWith('blob:') && !source.includes('/__office_md_fs/asset?') && !source.startsWith('data:')) {
      source = await resolve?.(original) ?? ''
      if (!source) throw new Error(`Could not package the workspace image: ${original}`)
    }
    if (source.startsWith('data:')) { image.src = source; image.removeAttribute('srcset'); continue }
    const url = new URL(source, globalThis.location?.href ?? 'http://localhost/')
    const localBridge = url.origin === globalThis.location?.origin && url.pathname === '/__office_md_fs/asset'
    if (!source.startsWith('blob:') && !localBridge) continue
    const fragment = url.hash
    url.hash = ''
    const target = url.toString()
    let data = encoded.get(target)
    if (!data) {
      const response = await fetch(target)
      if (!response.ok) throw new Error(`Could not package the workspace image: ${original}`)
      const declared = Number(response.headers.get('content-length'))
      if (declared > 50 * 1024 * 1024 - total) throw new Error('Export images exceed the 50 MiB limit.')
      const bytes = await response.arrayBuffer()
      total += bytes.byteLength
      if (total > 50 * 1024 * 1024) throw new Error('Export images exceed the 50 MiB limit.')
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error(`Could not encode the workspace image: ${original}`))
        reader.readAsDataURL(new Blob([bytes], { type: response.headers.get('content-type') ?? 'application/octet-stream' }))
      })
      encoded.set(target, data)
    }
    image.src = `${data}${fragment}`
    image.removeAttribute('srcset')
  }
  return clone
}
