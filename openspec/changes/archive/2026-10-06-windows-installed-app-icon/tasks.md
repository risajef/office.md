## 1. Windows Icon Asset and Configuration

- [x] 1.1 Add a failing Electron packaging test that requires a valid multi-resolution Windows `.ico` asset and an explicit `win.icon` configuration; run the focused test and confirm it fails before implementation.
- [x] 1.2 Create a multi-resolution `.ico` from `public/favicon.svg`, configure electron-builder to use it for Windows, and verify the packaging test and icon inspection pass.

## 2. Windows Package Verification

- [x] 2.1 Cross-build the x64 Windows app directory and verify its executable contains icon resources; confirm the existing `windows-latest` release job builds and smoke-tests NSIS, and that its Start menu shortcut inherits the executable icon.
- [x] 2.2 Run `npm test`, `npm run build`, `npm run build:electron`, and `npm run spec:validate`; verify the full packaging configuration and specifications pass.
