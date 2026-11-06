export type WorkspaceLimits = { maxEntries: number; maxDepth: number; maxFileBytes: number; maxTextBytes: number }
export const DEFAULT_WORKSPACE_LIMITS: WorkspaceLimits = {
  maxEntries: 5_000, maxDepth: 32, maxFileBytes: 10 * 1024 * 1024, maxTextBytes: 50 * 1024 * 1024,
}
export const createWorkspaceBudget = (overrides: Partial<WorkspaceLimits> = {}) => {
  const limits = { ...DEFAULT_WORKSPACE_LIMITS, ...overrides }
  let entries = 0
  let textBytes = 0
  return {
    entry(depth: number, bytes = 0, text = false) {
      if (++entries > limits.maxEntries) throw new Error(`Workspace exceeds the ${limits.maxEntries} visible entry limit.`)
      if (depth > limits.maxDepth) throw new Error(`Workspace exceeds the ${limits.maxDepth} directory depth limit.`)
      if (text && bytes > limits.maxFileBytes) throw new Error(`Workspace text file exceeds the ${limits.maxFileBytes} byte file limit.`)
      if (text) textBytes += bytes
      if (textBytes > limits.maxTextBytes) throw new Error(`Workspace exceeds the ${limits.maxTextBytes} byte text limit.`)
    },
  }
}
