## Why

Acyclic repeated includes can multiply portable output and deeply nested includes can exhaust the JavaScript stack.

## What Changes

- Limit include expansion depth and total generated UTF-8 bytes.
- Fail with an explanatory export error while preserving ordinary cycle and missing-include behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `export`: Bound portable include expansion

## Impact

Portable Markdown expansion and share/export call paths; bounded fixtures.

Non-goals: Changing include resolution semantics or supported CSV formulas.
