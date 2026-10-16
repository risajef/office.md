import { parseSharePayload, type SharePayload } from './share-document'

export type ShareCopyStorage = {
  get: (id: string) => Promise<SharePayload | undefined>
  put: (payload: SharePayload) => Promise<void>
}

export type ShareCopyRepository = {
  get: (id: string) => Promise<SharePayload | undefined>
  put: (payload: SharePayload) => Promise<{ persistent: boolean }>
}

const DATABASE_NAME = 'office-md-shared-copies'
const DATABASE_VERSION = 1
const STORE_NAME = 'copies'

const clonePayload = (payload: SharePayload) => parseSharePayload(
  JSON.stringify(payload),
  { maxBytes: Number.POSITIVE_INFINITY },
)

const openDatabase = (factory: IDBFactory) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('Could not open shared copy storage.'))
})

const transactionComplete = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error ?? new Error('Could not update shared copy storage.'))
  transaction.onabort = () => reject(transaction.error ?? new Error('Shared copy storage transaction was aborted.'))
})

export const createIndexedDbShareCopyStorage = (
  factory: IDBFactory | undefined = globalThis.indexedDB,
): ShareCopyStorage | undefined => {
  if (!factory) return undefined
  let databasePromise: Promise<IDBDatabase> | undefined
  const database = () => databasePromise ??= openDatabase(factory)
  return {
    async get(id) {
      const db = await database()
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const complete = transactionComplete(transaction)
        const request = transaction.objectStore(STORE_NAME).get(id)
        const value = await new Promise<unknown>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error ?? new Error('Could not read the shared copy.'))
        })
        await complete
        return value && typeof value === 'object'
          ? clonePayload(value as SharePayload)
          : undefined
      } finally {
        db.close()
        databasePromise = undefined
      }
    },
    async put(payload) {
      const db = await database()
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).put(clonePayload(payload))
        await transactionComplete(transaction)
      } finally {
        db.close()
        databasePromise = undefined
      }
    },
  }
}

export const createShareCopyRepository = (
  storage?: ShareCopyStorage,
): ShareCopyRepository => {
  const sessionCopies = new Map<string, SharePayload>()
  return {
    async get(id) {
      try {
        const stored = await storage?.get(id)
        if (stored) {
          const copy = clonePayload(stored)
          sessionCopies.set(id, copy)
          return clonePayload(copy)
        }
      } catch {
        // A failed persistent read leaves any current-tab copy available.
      }
      const sessionCopy = sessionCopies.get(id)
      return sessionCopy ? clonePayload(sessionCopy) : undefined
    },
    async put(payload) {
      const copy = clonePayload(payload)
      sessionCopies.set(copy.id, copy)
      if (!storage) return { persistent: false }
      try {
        await storage.put(clonePayload(copy))
        return { persistent: true }
      } catch {
        return { persistent: false }
      }
    },
  }
}

export const createDefaultShareCopyRepository = () =>
  createShareCopyRepository(createIndexedDbShareCopyStorage())
