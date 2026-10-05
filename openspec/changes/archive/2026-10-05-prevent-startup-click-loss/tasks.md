## 1. Startup Selection Readiness

- [x] 1.1 Update end-to-end flows to assert startup controls are initially disabled, become enabled before selection, and open the chosen folder or file successfully; confirm the new readiness assertion fails against the current implementation.
- [x] 1.2 Render startup actions disabled and enable them after registering their handlers; verify with `npm run test:e2e -- tests/e2e/electron.spec.ts`.

## 2. Release Verification

- [x] 2.1 Run the release validation checks: `npm test`, `npm run build:electron`, `npm run test:e2e`, `npm run build`, and `npm run spec:validate`.
