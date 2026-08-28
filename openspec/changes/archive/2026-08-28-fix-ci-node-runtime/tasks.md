## 1. Runtime contract regression

- [x] 1.1 Add a unit contract test at the package/workflow boundary that expects the declared Node engine and all Electron release jobs to use Node 22.22.2 or newer; verify the focused test fails while the workflow still uses Node 20.

## 2. Runtime alignment

- [x] 2.1 Update `package.json` and the lockfile to declare Node 22.22.2 or newer, and update validation, packaging, and publication setup steps in `.github/workflows/release-electron.yml` to use Node 22.22.2; verify the focused contract test passes.

## 3. Verification and handoff

- [x] 3.1 Run `npm ci`, `npm test`, `npm run build`, `npm run build:electron`, `npm run spec:validate`, and workflow YAML parsing; verify Vitest starts without unhandled jsdom/undici worker errors and no generated output is added to version control.
