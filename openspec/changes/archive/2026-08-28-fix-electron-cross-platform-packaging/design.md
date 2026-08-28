## Context

See `proposal.md` for the two packaging failures. `scripts/build-electron.mjs` resolves the platform-specific npm binaries as `tsc`/`vite` on Unix and `tsc.cmd`/`vite.cmd` on Windows, then invokes them with `spawnSync`. The `package:electron` script already supplies the single non-publishing policy, while the release workflow currently repeats it.

## Goals / Non-Goals

**Goals:**

- Make both fixed build commands executable on Windows runners.
- Ensure the release packaging invocation cannot turn a non-publishing package job into a GitHub publish attempt through duplicate CLI values.
- Preserve the explicit `release:publish` job as the only release publication path.

**Non-Goals:**

- No cross-compilation, application runtime, or release-asset behavior changes.
- No changes to the electron-builder targets or GitHub release publisher implementation.

## Decisions

- Set `shell: process.platform === 'win32'` in the shared `spawnSync` options. Windows npm binaries are `.cmd` command scripts and require the Windows command shell; Unix commands continue to run directly. Replacing the commands with hard-coded executable paths would be less portable across npm installations.
- Keep `--publish never` in `package.json` and remove it from the workflow's `package:electron` arguments. This leaves local packaging safe by default and ensures electron-builder receives one scalar publish policy rather than an array created by duplicate flags. Making the workflow the only owner would make local packaging on a tag/CI context unsafe.
- Add static contract assertions at the existing unit seams: the build script must opt into the Windows shell, the package script must retain `--publish never`, and the workflow must not pass another publish flag. These assertions protect the public commands without trying to execute Windows-only binaries on the Linux test host.

## Risks / Trade-offs

- [Shell invocation] Shell execution adds one command-resolution layer on Windows. -> The command names are fixed project-local npm binaries, not user-provided input, and the option is enabled only on Windows.
- [Manual redundant flags] A caller who explicitly appends another `--publish never` still creates duplicate CLI values. -> Document and test the workflow's canonical invocation; the package command already defaults to non-publishing and therefore needs no extra flag.
- [Builder behavior changes] Future electron-builder versions may alter duplicate-option parsing. -> Keeping one publish flag removes reliance on that undefined/ambiguous parsing behavior.
