import { createDocumentSaveController } from './document-save-controller'

export type WorkspaceConflict = {
  fileId: string
  fileName: string
  localMarkdown: string
  diskFileExists: boolean
  diskMarkdown?: string
}

/** Own persistence bookkeeping separately from widgets and observed disk snapshots. */
export const createDocumentSession = (options: Parameters<typeof createDocumentSaveController>[0]) => {
  let generation = 0
  const saves = createDocumentSaveController({
    ...options,
    workspaceId: () => {
      const id = options.workspaceId()
      return id ? JSON.stringify([id, generation]) : undefined
    },
  })
  const dirty = new Set<string>()
  const clean = new Map<string, string>()
  const conflicts = new Map<string, WorkspaceConflict>()
  const session = {
    isDirty: (id: string) => dirty.has(id),
    markDirty: (id: string) => { dirty.add(id) },
    markClean(id: string, markdown: string) { clean.set(id, markdown); dirty.delete(id) },
    clean: (id: string) => clean.get(id),
    conflict: (id: string) => {
      const value = conflicts.get(id)
      return value ? { ...value } : undefined
    },
    setConflict: (id: string, value: WorkspaceConflict) => { conflicts.set(id, { ...value }); dirty.add(id) },
    updateConflict(id: string, value: Partial<WorkspaceConflict>) {
      const current = conflicts.get(id)
      if (current) conflicts.set(id, { ...current, ...value })
    },
    clearConflict: (id: string) => { conflicts.delete(id) },
    get conflicts() { return [...conflicts.values()].map((value) => ({ ...value })) },
    remove(id: string) { dirty.delete(id); clean.delete(id); conflicts.delete(id) },
    reset() { generation += 1; dirty.clear(); clean.clear(); conflicts.clear() },
    rename(oldId: string, newId: string) {
      if (oldId === newId) return
      if (dirty.delete(oldId)) dirty.add(newId)
      const previous = clean.get(oldId)
      if (previous !== undefined) { clean.set(newId, previous); clean.delete(oldId) }
      const conflict = conflicts.get(oldId)
      if (conflict) { conflicts.set(newId, { ...conflict, fileId: newId }); conflicts.delete(oldId) }
    },
    async save(file: Parameters<typeof saves.save>[0]) {
      const id = file.id
      dirty.add(id)
      const saved = await saves.save(file)
      if (!saved.workspaceCurrent || file.id !== id) return false
      clean.set(id, saved.markdown)
      if (saved.current) dirty.delete(id)
      else dirty.add(id)
      return saved.current
    },
  }
  return session
}
