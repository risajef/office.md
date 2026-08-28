## Why

Invalid Mermaid source currently leaves Mermaid's temporary error SVG at the end of the document. The editor should keep Mermaid rendering errors inside the diagram preview so an error cannot appear as unrelated content below the document.

## What Changes

- Keep Mermaid's render target scoped to the diagram preview.
- Show the existing Mermaid error state in that preview when rendering fails.
- Add a regression scenario proving that failed rendering does not append content to the document body.
- Non-goals: changing Mermaid syntax validation, rewriting invalid source, or changing valid diagram rendering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown`: Mermaid rendering errors stay within the diagram preview and do not add stray content below the document.

## Impact

- `src/plugins/mermaid-plugin.ts` render integration.
- `tests/e2e/editor.spec.ts` browser-level regression coverage.
- No dependency or persistence changes.
