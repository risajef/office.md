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

Use these commands for the supported targets:

```bash
npm run dev              # web development renderer
npm run build            # web production build
npm run build:electron   # Electron main/preload plus the shared renderer
npm run electron:start   # build and launch Electron
npm run test:e2e         # web workflows and the Electron launch smoke test
```

Electron exposes only the workspace operations required by the port. The renderer has context isolation enabled and Node integration disabled; all workspace-relative paths are validated in the main process before disk access.

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
