## 1. Packaged smoke executable contract

- [x] 1.1 Add a failing packaging contract assertion requiring `office.md.exe` on Windows and `milkdown-minimal-editor` on Linux in `scripts/package-smoke.mjs`; verify `npm test -- tests/unit/electron-packaging.test.ts` fails before the implementation change.
- [x] 1.2 Update the smoke check's Windows executable expectation while preserving the Linux expectation; verify the focused packaging test passes and the Windows path resolves to the executable emitted by electron-builder.

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run build`, `npm run build:electron`, `npm run package:smoke`, and `npm run spec:validate`; verify no generated output is added to version control.
