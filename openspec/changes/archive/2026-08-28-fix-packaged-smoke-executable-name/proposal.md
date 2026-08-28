## Why

The Windows packaged-application smoke check looks for the npm package name, but electron-builder names the Windows executable from the configured product name. As a result, the release workflow fails before it can validate an otherwise valid Windows package.

## What Changes

- Make the packaged smoke check expect the executable name emitted by the Windows packaging configuration.
- Add a regression contract test so future product-name changes keep the smoke check and packager aligned.

### Non-goals

- No changes to the application runtime, release artifact names, installer configuration, or supported platforms.
- No changes to the product-level release requirements.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a release-test tooling correction; the existing release-distribution behavior remains unchanged.

## Impact

- `scripts/package-smoke.mjs` executable discovery on Windows.
- `tests/unit/electron-packaging.test.ts` packaging contract coverage.
- No runtime dependencies, user data, or published artifact names are affected.
