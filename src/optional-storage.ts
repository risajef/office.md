type StorageBoundary = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Browser cache is optional; access failures never interrupt document work. */
export const createOptionalStorage = (
  acquire: () => StorageBoundary = () => window.localStorage,
) => ({
  getItem(key: string): string | null {
    try { return acquire().getItem(key) } catch { return null }
  },
  setItem(key: string, value: string): boolean {
    try { acquire().setItem(key, value); return true } catch { return false }
  },
  removeItem(key: string): boolean {
    try { acquire().removeItem(key); return true } catch { return false }
  },
})

export const optionalStorage = createOptionalStorage()
