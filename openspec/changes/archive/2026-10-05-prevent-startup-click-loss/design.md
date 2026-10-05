## Context

See [proposal.md](proposal.md) for the startup race and scope. The startup controls are present in static HTML while `startEditor()` asynchronously creates the Milkdown editor and registers their click handlers.

## Goals / Non-Goals

**Goals:** Make the startup controls unavailable until their handlers can process selection requests.

**Non-Goals:** Change workspace selection, file ordering, or startup-screen content.

## Decisions

- Mark both startup buttons disabled in `index.html`, so they are inert as soon as the document renders.
- Enable each button in `startEditor()` after both click handlers have been registered. This keeps the prompt visible while ensuring an enabled action has a listener. Hiding the prompt until initialization completes would also prevent early activation, but would delay the requested first-run choice.
- Keep the existing Electron end-to-end flows as the public behavior seam and explicitly assert readiness before selecting a folder or file.

## Risks / Trade-offs

- If editor initialization fails, the startup actions stay disabled. The existing initialization error message remains visible in the editor area.

## Migration Plan

No data migration is required. The change takes effect when the updated application starts.
