## Why

The Windows packaging job cannot start the Electron build because Node tries to execute `tsc.cmd` without a Windows shell and fails with `EINVAL`. The packaging workflow also passes `--publish never` on top of the same flag already owned by the `package:electron` script, so electron-builder can parse duplicate values as an enabled publish policy and fail while looking for `GH_TOKEN`.

## What Changes

- Run the fixed local build commands through the Windows shell when invoking `.cmd` wrappers, while keeping direct execution on Unix-like hosts.
- Make the packaging workflow pass only platform and architecture arguments; the package script remains the single owner of the non-publishing `--publish never` policy.
- Add regression coverage for both the Windows command-runner contract and duplicate publish-flag prevention.

### Non-goals

- No changes to Electron application code, release publication, target formats, artifact names, or GitHub permissions.
- No change to the intentional release publisher script, which is the only path allowed to publish GitHub Releases.
- No support for cross-compiling a Windows installer from Linux.

## Capabilities

### New Capabilities

None. This is a cross-platform packaging and CI compatibility fix.

### Modified Capabilities

None. No product-level requirement changes.

## Impact

- `scripts/build-electron.mjs` process invocation options.
- `.github/workflows/release-electron.yml` package command arguments.
- Unit contract tests for the build runner and release workflow.
