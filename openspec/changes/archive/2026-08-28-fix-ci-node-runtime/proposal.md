## Why

The release workflow installs the project's current development dependencies with Node 20, but the locked `jsdom` and `undici` versions require a newer Node 22 runtime. As a result, `npm test` fails before any test starts when the GitHub runner initializes Vitest's jsdom workers.

## What Changes

- Align the repository's declared development/runtime minimum with the versions required by the locked test dependencies.
- Run every Electron release workflow job with a compatible Node 22 runtime so unit tests, builds, and packaging use the same supported environment.
- Add regression coverage for the runtime contract and keep the existing test command unchanged.

### Non-goals

- No changes to editor behavior, Electron runtime behavior, release triggers, package formats, or application dependencies.
- No replacement of `jsdom`, `undici`, or Vitest with another test stack.

## Capabilities

### New Capabilities

None. This is a development-tooling and CI compatibility fix.

### Modified Capabilities

None. No product-level requirement changes.

## Impact

- `package.json` and `package-lock.json` runtime metadata.
- `.github/workflows/release-electron.yml` Node setup steps.
- A unit-level contract test that prevents the workflow and package engine from drifting below the dependency-supported runtime.
