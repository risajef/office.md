import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executable = (name) => process.platform === 'win32' ? `${name}.cmd` : name

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(executable('tsc'), ['-p', 'tsconfig.electron.json'])
await mkdir(path.join(projectRoot, 'dist-electron'), { recursive: true })
await writeFile(
  path.join(projectRoot, 'dist-electron', 'package.json'),
  '{"type":"commonjs"}\n',
  'utf8',
)
run(executable('vite'), ['build'])
