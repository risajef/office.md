## Why

Replacing renderer workspace files clears evaluated CSV outputs but retains input markers, so reopening the same path may incorrectly skip formula evaluation.

## What Changes

- Re-evaluate CSV when its output cache is absent even if its source marker matches.
- Cover reopening the same workspace with an included formula spreadsheet.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Restore CSV evaluations after workspace replacement

## Impact

CSV evaluation cache invalidation and a real browser reopening regression.

Non-goals: Changes to formula semantics or the workspace scan cache.
