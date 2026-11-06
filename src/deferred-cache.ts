/** Optional cache work runs after an editing burst, with an explicit exit flush. */
export const createDeferredCache = (write: () => void, delay = 450) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    schedule() {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => { timer = undefined; write() }, delay)
    },
    flush() {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      write()
    },
  }
}
