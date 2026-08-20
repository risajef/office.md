const API_ROOT = '/__office_md_fs'

export type LocalServerFile = {
  name: string
  markdown: string
}

export type LocalServerWorkspace = {
  id: string
  path: string
  name: string
}

export type LocalServerSnapshot = {
  workspace: LocalServerWorkspace
  files: LocalServerFile[]
  directories: string[]
}

export type LocalServerCapabilities = {
  available: true
  defaultPath: string
}

export type LocalServerDirectory = {
  path: string
  parent: string | null
  directories: Array<{
    name: string
    path: string
  }>
}

const readJson = async <Result>(response: Response): Promise<Result> => {
  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    throw new Error('The local filesystem bridge returned an invalid response.')
  }
  const body = await response.json() as Result & { error?: unknown }
  if (!response.ok) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : `Filesystem request failed (${response.status}).`,
    )
  }
  return body
}

const post = async <Result>(route: string, body: unknown) => readJson<Result>(
  await fetch(`${API_ROOT}/${route}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }),
)

export const getLocalServerCapabilities = async () => {
  try {
    const response = await fetch(`${API_ROOT}/capabilities`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    return await readJson<LocalServerCapabilities>(response)
  } catch {
    return undefined
  }
}

export const openLocalServerWorkspace = (path: string) =>
  post<LocalServerSnapshot>('open', { path })

export const browseLocalServerDirectory = (path: string) =>
  post<LocalServerDirectory>('browse', { path })

export const reloadLocalServerWorkspace = (workspaceId: string) =>
  post<LocalServerSnapshot>('reload', { workspaceId })

export const getLocalServerAssetUrl = (workspaceId: string, name: string) =>
  `${API_ROOT}/asset?workspaceId=${encodeURIComponent(workspaceId)}&name=${encodeURIComponent(name)}`

export const writeLocalServerFile = (
  workspaceId: string,
  name: string,
  markdown: string,
) => post<{ ok: true }>('write', { workspaceId, name, markdown })

export const renameLocalServerFile = (
  workspaceId: string,
  oldName: string,
  newName: string,
) => post<{ ok: true }>('rename', { workspaceId, oldName, newName })

export const createLocalServerDirectory = (
  workspaceId: string,
  name: string,
) => post<{ ok: true }>('mkdir', { workspaceId, name })

export const deleteLocalServerFile = (
  workspaceId: string,
  name: string,
) => post<{ ok: true }>('delete-file', { workspaceId, name })

export const deleteLocalServerDirectory = (
  workspaceId: string,
  name: string,
) => post<{ ok: true }>('delete-directory', { workspaceId, name })
