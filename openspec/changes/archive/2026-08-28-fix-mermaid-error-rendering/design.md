## Context

The Mermaid NodeView owns a `.mermaid-preview` element, but the current call to Mermaid's render API omits that element. Mermaid consequently creates a temporary render node under `document.body`; its syntax-error path can leave that node behind after the promise rejects.

## Goals / Non-Goals

**Goals:**

- Scope Mermaid's temporary render DOM to the diagram preview.
- Preserve the existing editor-owned error message and valid-diagram behavior.
- Verify the observable result through the browser editor surface.

**Non-Goals:**

- Changing Mermaid configuration or syntax validation.
- Sanitizing, repairing, or persisting invalid Mermaid source differently.
- Adding a new rendering abstraction.

## Decisions

- Pass the existing preview element as Mermaid's render container. This uses the public API seam intended for embedded diagrams and ensures temporary nodes are colocated with the diagram. Mermaid's fallback error SVG therefore cannot be appended to the document body; the existing rejection handler can replace the preview contents with the editor's error state.
- Add the regression at the E2E editor seam. The user-visible contract spans asynchronous Mermaid rendering and the document DOM, so a browser test is more reliable than mocking Mermaid internals or asserting a private helper.
- Keep the current render-sequence guard and error handling unchanged. They already prevent stale asynchronous renders from replacing a newer diagram state.

## Risks / Trade-offs

- [Risk] Mermaid clears the supplied preview before each render. -> Mitigation: rendering already replaces the preview with a loading state, and the preview is the dedicated container rather than a shared document surface.
- [Risk] Mermaid changes its container behavior in a future version. -> Mitigation: the regression checks the public result (error remains in the preview and no stray body content), not Mermaid's internal cleanup implementation.

## Migration Plan

No migration is required. The change takes effect on the next application build; invalid source remains unchanged and only its rendered error location changes.
