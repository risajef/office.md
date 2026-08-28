## Why

office.md should be deliverable as both a browser-based editor and a desktop application without creating two products that drift apart. The current application combines document behavior, editor UI, and local filesystem access in one runtime, which makes a second host expensive and increases the risk of duplicated fixes. This change establishes a shared product surface with explicit host capabilities so the web and Electron targets can evolve together.

## What Changes

- Introduce a supported web target that provides the complete office.md editing experience.
- Introduce a supported Electron target that provides the same document, workspace, include, preview, and export behavior through desktop filesystem capabilities.
- Define a host-neutral boundary for workspace access and other runtime capabilities so shared application code does not branch on Electron or browser details.
- Keep Markdown, CSV, CSS, and image files in the opened workspace as the source of truth across both targets.
- Share the editor UI, document behavior, parsing, rendering, and export logic between targets; host-specific code is limited to adapters, lifecycle, packaging, and capability wiring.
- Add target-specific automated coverage and a verification path that checks the shared behavior in both supported hosts.
- Explicitly defer the VS Code integration, including custom editors and VS Code webviews, to a future change.

## Capabilities

### New Capabilities

- `runtime-hosts`: Deliver the office.md editor through web and Electron hosts with shared behavior and explicit runtime capabilities.

### Modified Capabilities

- `workspace`: Preserve secure, disk-backed workspace behavior when the editor is hosted by either the browser target or the Electron target.

## Impact

- Affected application boundaries in `src/`, especially the current workspace filesystem implementations and the large UI composition in `src/main.ts`.
- New host entry points, runtime adapters, build commands, and packaging configuration for the web and Electron targets.
- Shared unit tests plus host-level browser/desktop coverage; existing Markdown, CSV, workspace, and export behavior must remain green.
- No new persistence database is introduced. Existing workspace safety rules, include rules, formula handling, and export contracts remain in force.
