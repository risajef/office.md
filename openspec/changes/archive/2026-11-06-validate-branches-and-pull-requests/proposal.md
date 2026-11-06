## Why

Subrepo validation runs only on release tags, delaying detection of ordinary source regressions.

## What Changes

- Validate pushes and pull requests before release packaging.
- Run unit tests, builds, specification checks and browser/Electron integration tests on Linux.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-distribution`: Validate ordinary source changes

## Impact

A separate read-only CI validation workflow using the existing release checks.

Non-goals: Publishing releases or changing the parent website deployment workflow.
