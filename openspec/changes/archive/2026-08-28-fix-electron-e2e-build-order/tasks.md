## 1. Workflow contract regression

- [x] 1.1 Extend the release workflow unit contract to require `npm run build:electron` before `npm run test:e2e`; verify the focused test fails against the current step order.

## 2. Correct validation order

- [x] 2.1 Move the existing Electron build step ahead of the browser/Electron E2E step without changing either command; verify the focused workflow test passes and the generated `dist-electron/electron/main.js` exists before E2E starts.

## 3. Verification and handoff

- [x] 3.1 Run `npm test`, `npm run build:electron`, `npm run test:e2e`, `npm run spec:validate`, and workflow YAML parsing; verify the Electron shell test launches from a clean-build state and no generated output is added to version control.
