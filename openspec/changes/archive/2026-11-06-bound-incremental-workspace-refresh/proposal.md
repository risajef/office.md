## Why

Polling rereads every document and traverses directories twice, while typing synchronously serializes unrelated files and re-evaluates unchanged spreadsheets.

## What Changes

- Scan Node directories once and reuse unchanged text by metadata.
- Reuse browser File snapshots when unchanged.
- Enforce workspace entry/depth/text budgets before loading.
- Debounce workspace caching and evaluate only changed CSV sources.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Bound workspace scanning and defer cache work

## Impact

Shared resource budget, Node scanner, browser scanner, optional cache scheduler, evaluated CSV invalidation and boundary tests.

Non-goals: Native filesystem watchers or eliminating directory metadata polling; initial loads remain eager within explicit limits.
