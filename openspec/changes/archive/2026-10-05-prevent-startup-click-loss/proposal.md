## Why

The startup choice is visible before the editor has attached its selection handlers. A quick click can be ignored, leaving the user on the startup screen without feedback. The release end-to-end suite reproduced this race.

## What Changes

- Keep the startup folder and file actions disabled until the editor is ready to handle them.
- Add Electron end-to-end coverage for the startup actions becoming available and opening the chosen workspace or file.
- Non-goals: changing file filters, folder ordering, remembered starting locations, or behavior after a selection is accepted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: startup selection actions must not appear actionable before the application can handle them.

## Impact

Affected areas: startup markup and initialization in `index.html` and `src/main.ts`, Electron end-to-end coverage, and the workspace startup specification. No API or dependency changes are required.
