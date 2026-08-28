## 1. Cross-platform build contract

- [x] 1.1 Add a unit contract test requiring the Electron build runner to use the Windows shell for `.cmd` binaries and requiring the package script to own `--publish never`; verify it fails against the current build script/package configuration.

## 2. Packaging fixes

- [x] 2.1 Enable the Windows shell in `scripts/build-electron.mjs` and remove the duplicate `--publish never` from the release workflow packaging command; verify the focused packaging/workflow tests pass.

## 3. Verification and handoff

- [x] 3.1 Run `npm test`, `npm run build:electron`, `npm run package:electron -- --linux --x64`, `npm run spec:validate`, and workflow YAML parsing; verify packaging remains non-publishing without `GH_TOKEN`, and no generated output is added to version control.
