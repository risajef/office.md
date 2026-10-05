# Development workflow

This repository uses OpenSpec as the planning layer and TDD as the implementation loop. The accepted behavior lives in `openspec/specs/`; an active change is the only place where proposed behavior belongs until it ships.

## Start a change

Read the relevant main specs, source files, and tests first. If the request contains uncertain terminology or architectural choices, invoke `$grill-with-docs`. It should ground the discussion in the repository, update `CONTEXT.md` as terms are resolved, and record only meaningful durable trade-offs as ADRs.

Then use one of these OpenSpec entry points:

```text
$openspec-explore <problem or idea>
$openspec-propose <clear change description>
```

The proposal produces `proposal.md`, spec deltas, an optional `design.md`, and `tasks.md`. Review those files before implementation. Correcting the plan is cheaper than correcting code.

## Implement test-first

Apply an active change with `$openspec-apply-change <change-name>`. For each task:

1. Choose the public seam and name the behavior from the spec.
2. Write one failing test with expected values taken from the spec or a fixed example.
3. Add only enough implementation to make that test pass.
4. Refactor after the suite is green, without changing behavior.
5. Run the narrowest relevant check and mark the task complete only when the scenario is actually covered.

Use Vitest for pure logic and DOM integration; use Playwright for user-visible workflows, real filesystem effects, downloads, and cross-component behavior.

## Runtime target workflow

The application has one renderer and two host adapters:

- `src/workspace-application.ts` owns host-neutral workspace actions and source-preserving document behavior.
- `src/workspace-port.ts` defines the capability contract used by the application runtime.
- `src/web-workspace-port.ts` chooses the local Vite bridge first and browser folder access second.
- `src/electron-workspace-port.ts` consumes only the narrow API exposed by `electron/preload.ts`.
- `electron/main.ts` and `electron/workspace-service.ts` own native dialogs, filesystem access, path validation, and IPC allowlisting.

This layering keeps workspace files as the cross-host source of truth. Markdown, CSV formulas, includes, Mermaid materialization, and exports stay above the host boundary. VS Code integration is not part of the current target set.

## Desktop release workflow

Release tags use the stable `vMAJOR.MINOR.PATCH` convention, such as `v0.1.0`. The `Release Electron` workflow runs only for pushed tags, checks that the tag matches `package.json`, validates the repository, and packages on native x64 Ubuntu and Windows runners. A package job cannot publish a GitHub Release.

The resulting assets are collected into one draft release and published only after the exact package and updater metadata manifest passes validation:

- `office.md-<version>-linux-x64.AppImage`
- `office.md-<version>-windows-x64.exe`
- `latest-linux.yml`
- `latest.yml`
- `office.md-<version>-windows-x64.exe.blockmap`

The Linux AppImage contains its block map, while the Windows NSIS target emits an external blockmap. The metadata validator checks stable versions, platform-specific package names, non-empty hashes, and that every referenced asset is present in the same release. The release stays a draft until the upload and verification steps succeed.

Users download these files from the repository's GitHub **Releases** page. A repeated run for the same tag replaces the matching assets in the existing release.

To package locally without publishing, run the target command on its native host:

```bash
npm run package:electron -- --linux --x64
npm run package:electron -- --win --x64
```

The command always passes electron-builder's `--publish never` flag and writes output below `release/`. The packages are currently unsigned; Windows SmartScreen and Linux desktop policies may warn users before the application starts.

### Desktop update behavior

Only packaged x64 Linux and Windows builds check the public `risajef/office.md` GitHub Releases source. The startup check runs asynchronously after the editor window opens; the desktop notification also provides **Check for updates** for a manual check. A found stable release is never downloaded automatically: the user chooses **Download update** or **Later**. Once downloaded, **Restart to install** hands control to electron-updater, while **Later** keeps the current application and workspace running.

Offline checks, invalid metadata, interrupted downloads, and failed installation handoffs produce a retryable notification and preserve the current version. The browser runtime, local development server, unpackaged Electron launches, and automated test sessions do not perform update checks. Packages remain unsigned until signing and notarization are added, so OS security warnings are expected.

Use these commands for the supported targets:

```bash
npm run dev              # web development renderer
npm run build            # web production build
npm run build:electron   # Electron main/preload plus the shared renderer
npm run electron:start   # build and launch Electron
npm run test:e2e         # web workflows and the Electron launch smoke test
```

Electron exposes only the workspace operations required by the port. The renderer has context isolation enabled and Node integration disabled; all workspace-relative paths are validated in the main process before disk access.

The independent style-folder capability follows the same boundary. `src/style-folder-port.ts` and `src/style-folder-application.ts` define the host-neutral read-only theme source, while `src/web-style-folder-port.ts` and `src/electron-style-folder-port.ts` adapt the local bridge, browser folder access, and secure Electron IPC. Electron stores only the last successfully scanned style-folder path in user-data preferences; CSS content is inlined for document and print exports, and external resources or nested `@import` graphs are intentionally outside the text-only contract.

## Close a change

Before archiving:

```bash
npm run spec:validate
npm test
npm run build
```

Use `$openspec-verify-change <change-name>` to check completeness, correctness, and coherence. Then use `$openspec-sync-specs <change-name>` to merge the delta into the main specs and `$openspec-archive-change <change-name>` when all tasks are checked off. Keep the archived change with the code in the same commit or pull request so the decision trail remains reviewable.

## CLI setup

The repository pins OpenSpec `1.11.0` as a development dependency for validation scripts. The interactive Codex skills expect the same CLI on `PATH`:

```bash
npm install
npm install --global @fission-ai/openspec@1.11.0
```

The OpenSpec profile used by this project installs the core workflow plus `verify`, as skills for Codex. If the global profile is reset, run `openspec config profile` and restore the custom workflow set before running `openspec update` in this repository.
