type DocumentFile = { id: string; name: string; markdown: string }

/** Save immutable revisions in order; completion never acknowledges newer edits. */
export const createDocumentSaveController = (options: {
  workspaceId: () => string | undefined
  writeFile: (name: string, markdown: string) => Promise<void>
}) => {
  const pending = new Map<string, Promise<unknown>>()
  return {
    async save(file: DocumentFile) {
      const { id, name, markdown } = file
      const workspaceId = options.workspaceId()
      if (!workspaceId) throw new Error('Open a workspace before saving.')
      const key = JSON.stringify([workspaceId, id])
      const previous = pending.get(key)
      const operation = (async () => {
        if (previous) await previous.catch(() => undefined)
        if (options.workspaceId() !== workspaceId) {
          throw new Error('The workspace changed before this document could be saved.')
        }
        await options.writeFile(name, markdown)
        const workspaceCurrent = options.workspaceId() === workspaceId
        return {
          markdown,
          workspaceCurrent,
          current: workspaceCurrent && file.id === id && file.name === name && file.markdown === markdown,
        }
      })()
      pending.set(key, operation)
      try {
        return await operation
      } finally {
        if (pending.get(key) === operation) pending.delete(key)
      }
    },
  }
}
