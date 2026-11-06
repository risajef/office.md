## Why

Lexical traversal checks allow requests through symlinked ancestors to read or mutate outside the selected workspace.

## What Changes

- Share one Node workspace path policy between Electron and HTTP.
- Reject symlink components before reads and mutations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Reject symlink workspace targets

## Impact

Shared Node path policy, Electron workspace service and Vite HTTP bridge; real filesystem regressions.

Non-goals: Supporting symlinked workspace entries or defending against an equally privileged hostile process swapping filesystem entries during a syscall sequence.
