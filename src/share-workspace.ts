import { isImageFile, isWorkspaceFile, shouldSkipDirectory } from './editable-files'
import {
  createFileSharePayload,
  createWorkspaceSharePayload,
  shareMimeTypeForPath,
  validateSharePath,
  type SharePayload,
} from './share-document'

export type CurrentShareFile = {
  name: string
  markdown: string
  kind?: 'markdown' | 'csv' | 'css' | 'image'
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export const createCurrentFileSharePayload = (input: {
  id: string
  file: CurrentShareFile
  portableMarkdown?: string
}) => {
  if (input.file.kind === 'css' || input.file.kind === 'image') {
    throw new Error('Share File supports Markdown and CSV files only.')
  }
  return createFileSharePayload({
    id: input.id,
    name: input.file.name.replaceAll('\\', '/').split('/').at(-1) ?? input.file.name,
    content: input.file.markdown,
    ...(input.file.kind === 'markdown' || input.file.name.match(/\.markdown?$/i)
      ? { portableContent: input.portableMarkdown }
      : {}),
  })
}

export const collectWorkspaceSharePayload = async (input: {
  id: string
  name: string
  files: CurrentShareFile[]
  readImage: (name: string) => Promise<Uint8Array | undefined>
}): Promise<SharePayload> => {
  const records = await Promise.all(input.files.map(async (file) => {
    if (!isWorkspaceFile(file.name)) return undefined
    if (file.name.replaceAll('\\', '/').split('/').some(shouldSkipDirectory)) {
      return undefined
    }
    let path: string
    try {
      path = validateSharePath(file.name)
    } catch {
      return undefined
    }
    const mimeType = shareMimeTypeForPath(path)
    if (!mimeType) return undefined
    if (isImageFile(path)) {
      try {
        const bytes = await input.readImage(path)
        if (!bytes) return undefined
        return {
          path,
          mimeType,
          encoding: 'base64' as const,
          content: encodeBase64(bytes),
        }
      } catch {
        return undefined
      }
    }
    return {
      path,
      mimeType,
      encoding: 'utf8' as const,
      content: file.markdown,
    }
  }))
  const files = records.filter((record): record is NonNullable<typeof record> => Boolean(record))
  return createWorkspaceSharePayload({
    id: input.id,
    name: input.name,
    files,
  })
}
