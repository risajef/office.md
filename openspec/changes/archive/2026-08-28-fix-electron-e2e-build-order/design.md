## Context

See `proposal.md` for the failing clean-checkout scenario. The Electron end-to-end test launches the repository through `package.json` and therefore requires the compiled main entry point at `dist-electron/electron/main.js`. `scripts/build-electron.mjs` creates that output before starting the Vite renderer build.

## Goals / Non-Goals

**Goals:**

- Ensure the release validation job has the Electron entry point before invoking the combined browser/Electron E2E suite.
- Protect the step dependency with a focused static workflow contract test.
- Leave local commands and the Electron test's runtime behavior unchanged.

**Non-Goals:**

- No changes to Playwright configuration, test fixtures, Electron source, or packaging.
- No changes to the release trigger or publication gates.

## Decisions

- Move the existing `Build Electron entry points` step before `Run browser and Electron tests` in the validation job. This is the smallest fix because it supplies the exact missing file while preserving the current build command and test command. Adding a build inside the test itself would make a test command mutate build output implicitly and would duplicate the workflow's explicit build responsibility.
- Keep the separate production-renderer build step. Although `build:electron` also invokes Vite, retaining the existing validation step avoids changing which named checks the release job reports and keeps this fix limited to sequencing.
- Assert ordering by locating the public workflow commands in `tests/unit/release-workflow.test.ts`. The test does not inspect Playwright or Electron internals; it verifies the CI contract that caused the failure.

## Risks / Trade-offs

- [Duplicate renderer build] The workflow still invokes Vite through both build commands. -> Preserve it for now as an explicit existing release validation check; optimization is outside this bug fix.
- [Future test changes] A different Electron test may require additional generated files. -> Keep build prerequisites explicit in the workflow and extend the workflow contract when a new generated prerequisite is introduced.
