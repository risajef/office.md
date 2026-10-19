## Context

office.md currently supports two paradigms for workspaces:
1. **Disk-backed workspaces**: Folders opened via local filesystem bridge (development server), Electron desktop port, or browser File System Access API.
2. **Shared isolated copies**: Documents or workspaces opened via a share URL or Electron ZIP archive, which store modifications in an isolated IndexedDB repository (`office-md-shared-copies`) under a unique payload `id`. These isolated workspaces already support editing, file management, auto-persisting to browser storage, exporting, and creating new share URLs / archives.

The startup screen (`#startup-choice`) currently provides two primary buttons (`#startup-open-folder` and `#startup-open-file`), plus an `#startup-open-share-zip` button that is enabled only in Electron. In web mode, users without a local disk folder cannot proceed without picking a local directory or starting with a share URL.

## Goals / Non-Goals

**Goals:**
- Provide a clear, accessible button on the startup card in the browser (`#startup-new-empty-project` / "Start empty project") to initialize a clean workspace stored in browser storage.
- Hide this button in desktop Electron environments where workspace files must be disk-backed.
- Seed the new workspace with an initial empty markdown document (`document.md`) and default workspace name (e.g., `Untitled Project` or `Browser workspace`).
- Leverage the existing shared-copy isolation and IndexedDB persistence mechanism so the project is automatically persisted locally and can later be re-shared or exported.
- Keep disk-backed workspace behaviors, Electron startup, and existing share link workflows intact.

**Non-Goals:**
- Allowing disk-less projects in desktop Electron.
- Cloud syncing or server-side accounts/databases.
- Changing existing local folder picker workflows or disk-backed document lifecycles.

## Decisions

### 1. Reusing the isolated browser workspace model
- **Decision**: Represent the empty browser workspace as an isolated browser-stored workspace, generating a fresh unique `id` (e.g. via `crypto.randomUUID()`), with `kind: 'workspace'`, an entry file `document.md`, and an initial blank (or welcoming header) content.
- **Rationale**: The infrastructure for handling non-disk isolated workspaces, autosaving edits into IndexedDB (`ShareCopyRepository`), displaying save status ("Saved in isolated copy" / "browser storage"), adding/renaming/deleting files, and re-sharing via URL is already built and tested.
- **Alternatives considered**:
  - Inventing a third workspace concept ("unbound" or "virtual" workspace): unnecessary complexity and duplication when the existing `SharePayload` model already fulfills the exact persistence, safety, and sharing contracts.

### 2. Startup UI integration
- **Decision**: In `index.html`, add a button `#startup-new-empty-project` inside `.startup-choice-actions`. In `src/main.ts`, if `isElectronRuntime` is true, hide this button (`hidden = true`). In browser environments, keep it visible and enable it once the runtime is ready.
- **Rationale**: Clean separation between desktop Electron and browser web targets, adhering strictly to the specs.
- **Alternatives considered**:
  - Dynamically injecting the DOM node in JS only: Less declarative and harder to style/test consistently with static HTML templates.

### 3. Workspace naming and active file
- **Decision**: Name the initial project `Browser workspace` (or `New project`) and seed a single `document.md` file. Immediately activate this file upon clicking the startup button.
- **Rationale**: Immediate transition into a ready-to-write editor experience without blocking or requiring modal prompts.

## Risks / Trade-offs

- [Risk: Private browsing or disabled IndexedDB] → Mitigation: The existing `ShareCopyRepository` falls back gracefully to in-memory state and notifies the user with "browser storage unavailable · temporary copy" status, allowing editing and sharing without crashing.
- [Risk: Accidental loss of work on browser data clear] → Mitigation: The UI clearly indicates browser storage in the status bar and offers explicit export and URL sharing at all times.

