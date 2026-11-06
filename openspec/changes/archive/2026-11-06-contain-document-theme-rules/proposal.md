## Why

Selector prefixing allows sibling targets and stylesheet imports/global rules can affect application chrome or initiate network requests.

## What Changes

- Parse theme CSS before connecting it to the live document.
- Bound selected elements to the document subtree.
- Permit text/layout decoration and media/supports groups; remove global at-rules, network resources and positioned overlays.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown`: Enforce document theme policy

## Impact

Theme CSS parser/policy, scoped selectors and theme regression tests.

Non-goals: Supporting theme-defined external fonts, animations or arbitrary interactive CSS; application layout remains owned by the app.
