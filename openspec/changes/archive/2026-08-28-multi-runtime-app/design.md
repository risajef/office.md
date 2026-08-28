## Context

The existing Vite renderer contains the editor, workspace state, and host-specific filesystem calls in a single application composition. The repository already has useful reusable seams in the Markdown, CSV, export, and filesystem modules, but `src/main.ts` currently coordinates much of the behavior and the web filesystem options are not represented by one host contract.

The design must preserve the current disk-backed workspace model, browser fallback, file safety rules, and shared document behavior. It introduces a second host without exposing Node.js APIs to shared renderer code. VS Code is not part of this design.

## Goals / Non-Goals

**Goals:**

- Make the web and Electron targets two hosts of one shared editor runtime.
- Separate product behavior from workspace and runtime capabilities behind testable ports.
- Keep the existing web filesystem bridge and browser folder access working during migration.
- Give the Electron host secure, disk-backed access through a narrow main-process boundary.
- Enable adapter conformance tests and host-level tests without duplicating document assertions.

**Non-Goals:**

- A VS Code extension, VS Code webview, or custom editor provider.
- Cloud synchronization, accounts, collaboration, or a new product database.
- A visual redesign or changes to Markdown, CSV, include, formula, or export semantics.
- A full package/monorepo split before the shared seams have stabilized.

## Decisions

### Use a shared layered runtime

The renderer will be organized around four responsibilities:

- **Core behavior** contains pure Markdown, CSV, include, rendering, and export logic.
- **Application behavior** owns workspace/document actions and state transitions, depending on capability ports rather than browser or Electron globals.
- **Shared UI** renders the editor and invokes application actions without selecting a host.
- **Host shells and adapters** wire the web or Electron lifecycle and implement runtime capabilities.

The first migration can remain in the current repository and gradually extract modules from `src/main.ts`. A premature package split would add publishing and dependency boundaries before the actual seams are proven.

### Define one workspace capability port

Shared application code will depend on a workspace port that covers the observable operations already supported by the product: opening and reloading a workspace, reading text and image assets, writing text, and creating, renaming, and deleting entries. Results and failures will use host-neutral types and errors.

The port is an application boundary, not a second persistence layer. Each adapter remains responsible for translating its host's APIs and preserving the existing path validation, hidden-path, overwrite, and safe-deletion rules. A fake port will be used by application tests so those tests exercise public actions instead of private implementation details.

### Keep host-specific filesystem code behind adapters

The web adapter will retain the current preference order: use the local development filesystem bridge when present, otherwise use the browser File System Access API when supported. Browser capability detection and user-facing unsupported states stay at the host boundary.

The Electron adapter will expose only an allowlisted workspace API from a preload bridge. The Electron main process will own Node filesystem access and validate workspace-relative paths before performing operations. The renderer will run with context isolation and without direct Node integration; shared UI code will not import Electron or Node modules.

Electron is selected over a second browser wrapper because it keeps the existing TypeScript/Vite renderer and JavaScript ecosystem while providing the required local filesystem access. A native Rust-based wrapper could produce a smaller bundle, but it would introduce a second integration language and a separate host implementation before the shared boundary is established.

### Build one renderer and add a desktop shell

The web target will continue to build the shared renderer as a normal Vite application. The Electron target will load that same renderer from a desktop shell and add only its main-process and preload entry points. Host-specific build and packaging commands will be explicit, while document and workspace behavior will be compiled once for the renderer.

The renderer will receive its host capabilities through bootstrap wiring rather than checking the current runtime throughout the UI. This keeps the number of platform branches small and makes it possible to instantiate the same application with a fake, web, or Electron port in tests.

### Verify parity through contract and host tests

The shared application tests will run against a deterministic fake workspace port. Web and Electron adapters will share a contract suite covering successful operations and rejection of unsafe operations. Existing unit tests remain the regression suite for Markdown, CSV, workspace, and export behavior.

Playwright will continue to exercise the web target with real temporary workspaces. Electron smoke tests will launch the desktop shell against the same representative workflows, while detailed document assertions remain shared or adapter-independent wherever possible.

## Risks / Trade-offs

- **[Adapter drift]** Web and Electron could implement subtly different workspace behavior. → Run the same adapter contract tests and keep product actions above the adapter boundary.
- **[Desktop filesystem exposure]** An overly broad preload API could turn the desktop shell into an unintended filesystem gateway. → Keep Node access in the main process, expose an allowlist, validate every workspace-relative path, and deny unknown operations.
- **[Large extraction from `src/main.ts`]** A big-bang rewrite could break stable editor behavior. → Extract one public action seam at a time, start with characterization tests, and keep the existing web bootstrap usable throughout migration.
- **[Browser capability variance]** Some browsers cannot open or write local folders. → Preserve the local bridge fallback, expose capability status at the host boundary, and show an actionable error when no supported mechanism is available.
- **[Desktop distribution overhead]** Electron increases download size and adds release configuration. → Keep the desktop shell additive, reuse the renderer build, and defer signing/distribution automation until the target is behaviorally stable.

## Migration Plan

1. Add characterization tests around the current public workspace and application actions, then define the host-neutral types and workspace port.
2. Implement the minimal web adapter and move existing web bridge/browser-folder behavior behind it without changing the current user flow.
3. Extract shared application state and UI bootstrap from `src/main.ts`; run the shared behavior against the fake port and the web adapter.
4. Add the Electron main process, secure preload bridge, renderer bootstrap, and desktop development/build target.
5. Run shared unit tests, web end-to-end tests, Electron smoke tests, the production builds, and spec validation. Publish the Electron target only after the parity scenarios pass.

The migration is additive and has no data migration. Until the Electron target passes its host checks, the existing web target remains the release path. If the desktop shell must be rolled back, its entry points and packaging commands can be disabled while the shared web runtime and workspace files remain unchanged.
