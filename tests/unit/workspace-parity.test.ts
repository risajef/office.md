import { describe, expect, it } from 'vitest'
import { createElectronWorkspacePort } from '../../src/electron-workspace-port'
import { createWorkspaceApplication } from '../../src/workspace-application'
import { createWebWorkspacePort } from '../../src/web-workspace-port'
import {
  representativeCsvSource,
  representativeDocument,
  representativeIncludedMarkdown,
  representativePortableMarkdown,
} from '../fixtures/representative-workspace'
import type {
  ElectronWorkspaceApi,
} from '../../src/electron-api'
import type {
  WorkspaceBackend,
  WorkspacePort,
} from '../../src/workspace-port'
import { createMemoryWorkspacePort } from '../../src/workspace-port'

const seed = {
  path: '/tmp/office-md-parity',
  name: 'office-md-parity',
  files: [
    { name: 'document.md', markdown: representativeDocument },
    { name: 'included.md', markdown: representativeIncludedMarkdown },
    { name: 'metrics.csv', markdown: representativeCsvSource },
  ],
}

const createFixturePorts = () => {
  const memory = createMemoryWorkspacePort(seed)
  const backend: WorkspaceBackend = {
    name: 'fixture-web',
    isAvailable: async () => true,
    open: () => memory.open(),
    restore: () => memory.restore(),
    reload: () => memory.reload(),
    readFile: (name) => memory.readFile(name),
    readAssetUrl: (name) => memory.readAssetUrl(name),
    writeFile: (name, markdown) => memory.writeFile(name, markdown),
    renameFile: (oldName, newName) => memory.renameFile(oldName, newName),
    createDirectory: (name) => memory.createDirectory(name),
    deleteFile: (name) => memory.deleteFile(name),
    deleteDirectory: (name) => memory.deleteDirectory(name),
  }
  const web = createWebWorkspacePort([backend])

  const desktopMemory = createMemoryWorkspacePort(seed)
  const desktopApi: ElectronWorkspaceApi = {
    open: async () => {
      const snapshot = await desktopMemory.open()
      return snapshot
    },
    restore: () => desktopMemory.restore(),
    reload: () => desktopMemory.reload(),
    readFile: (_workspaceId, name) => desktopMemory.readFile(name),
    readAssetUrl: (_workspaceId, name) => desktopMemory.readAssetUrl(name),
    writeFile: (_workspaceId, name, markdown) => desktopMemory.writeFile(name, markdown),
    renameFile: (_workspaceId, oldName, newName) => desktopMemory.renameFile(oldName, newName),
    createDirectory: (_workspaceId, name) => desktopMemory.createDirectory(name),
    deleteFile: (_workspaceId, name) => desktopMemory.deleteFile(name),
    deleteDirectory: (_workspaceId, name) => desktopMemory.deleteDirectory(name),
  }
  const electron = createElectronWorkspacePort(desktopApi)

  return { web, electron }
}

const factories: Array<[string, () => WorkspacePort]> = [
  ['web', () => createFixturePorts().web],
  ['electron', () => createFixturePorts().electron],
]

describe.each(factories)('%s workspace behavior', (_name, createPort) => {
  it('keeps source, include, export, and safety outcomes aligned', async () => {
    const application = createWorkspaceApplication(createPort())
    await application.open()

    expect(application.createPortableMarkdown('document.md'))
      .toBe(representativePortableMarkdown)
    expect(application.file('metrics.csv')?.markdown).toContain('=B2*2')

    const changedCsv = 'label,value,total\nIdea,21,=B2*2\nWrite,34,=B3*2\n'
    await application.saveFile('metrics.csv', changedCsv)
    expect((await application.reload()).files.find((file) => file.name === 'metrics.csv')?.markdown)
      .toBe(changedCsv)

    await expect(application.saveFile('../outside.md', 'unsafe'))
      .rejects.toThrow('invalid')
  })
})
