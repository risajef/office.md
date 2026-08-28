## Why

The Electron end-to-end test is run from a clean GitHub Actions checkout before the Electron entry points are built. Playwright therefore starts Electron with the `package.json` main path, but `dist-electron/electron/main.js` does not exist and the validation job fails before packaging.

## What Changes

- Build the Electron entry points before the browser/Electron end-to-end suite in the release validation job.
- Add a workflow contract regression test that requires the build step to precede `npm run test:e2e`.
- Preserve the existing test command, Electron test, release targets, and package behavior.

### Non-goals

- No changes to the Electron main process, preload bridge, renderer, or workspace behavior.
- No changes to release triggers, artifact names, permissions, or packaging targets.
- No changes to the browser test server or Playwright test implementation.

## Capabilities

### New Capabilities

None. This is a CI sequencing fix.

### Modified Capabilities

None. No product-level requirement changes.

## Impact

- `.github/workflows/release-electron.yml` validation step order.
- `tests/unit/release-workflow.test.ts` workflow contract coverage.
- No runtime dependencies or persisted data are affected.
