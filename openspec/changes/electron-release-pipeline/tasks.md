## 1. Release identity

- [ ] 1.1 Add red unit tests for the release-version seam covering a valid `vMAJOR.MINOR.PATCH` tag, invalid branch/non-semver refs, and a tag/package-version mismatch; verify the focused Vitest file fails before the seam exists.
- [ ] 1.2 Implement the tested tag parser/version check and the `release:check-version` npm script; verify the focused tests pass and invalid input exits non-zero without changing `package.json` or `package-lock.json`.

## 2. Electron packaging

- [ ] 2.1 Add a red packaging-configuration test that requires the x64 Linux AppImage target, x64 Windows NSIS target, explicit `office.md-<version>-linux-x64.AppImage` and `office.md-<version>-windows-x64.exe` names, and inclusion of the existing renderer/Electron entry-point files; verify it fails before packaging configuration exists.
- [ ] 2.2 Add the electron-builder dependency, package metadata, target configuration, and an explicit non-publishing local `package:electron` command; update the lockfile and verify `npm ci`, the packaging-configuration test, `npm run build:electron`, and a native local package build pass where the host target is available.
- [ ] 2.3 Add a packaging smoke check for the generated application directory/package that launches the Electron shell (or its unpacked equivalent) and verifies the shared renderer and secure workspace bridge are available; verify it passes on the Linux and Windows packaging runners without requiring a repository checkout or separately installed Node.js runtime.

## 3. Release assembly and GitHub Actions

- [ ] 3.1 Add red unit tests for a release-asset manifest seam that accepts exactly the expected Linux and Windows files for a version and rejects missing, extra, or incorrectly named assets; verify the focused tests fail before the manifest seam exists.
- [ ] 3.2 Implement the release-asset manifest/verification seam and use it as the publication precondition; verify the focused tests pass for the success, missing-platform, and wrong-version cases.
- [ ] 3.3 Add a red workflow contract test for the tag-only trigger, validation-before-packaging dependency, native Ubuntu/Windows matrix, package publishing disabled in platform jobs, least-privilege release permission, and draft-before-publish sequence; verify it fails before the workflow is present.
- [ ] 3.4 Add `.github/workflows/release-electron.yml` with npm lockfile installation, version/test/build/OpenSpec validation, native Linux and Windows packaging jobs, workflow-artifact transfer, exact asset verification, and idempotent draft GitHub Release publication; verify the workflow contract test passes and the workflow reports errors instead of publishing incomplete assets.
- [ ] 3.5 Exercise the publication path with a dry-run or repository test fixture that proves both platform artifacts are collected before the release is marked published and a repeated tag replaces matching assets without creating a duplicate release; verify no GitHub write occurs during local/dry-run execution.

## 4. Documentation and final verification

- [ ] 4.1 Update `README.md` and the development workflow documentation with the `vMAJOR.MINOR.PATCH` convention, local non-publishing packaging command, Linux/Windows asset names, download locations, and unsigned-download caveat; verify every documented command and filename matches the implemented configuration.
- [ ] 4.2 Run the complete relevant validation after all behavior slices are green: `npm test`, `npm run build`, `npm run build:electron`, `npm run test:e2e`, `npm run spec:validate`, and the available native package smoke checks; verify no generated `dist/`, `release/`, `playwright-report/`, or `test-results/` output is committed.
