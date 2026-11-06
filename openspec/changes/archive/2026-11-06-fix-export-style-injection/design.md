## Context

Theme strings can terminate the exported style element and introduce executable HTML into exported documents and print previews.

## Goals / Non-Goals

The system SHALL preserve theme styling without interpreting theme text as HTML, and SHALL disable scripts in standalone exports and print previews.

Non-goals: Changing the supported theme selector policy or the Markdown sanitizer.

## Decisions

Escape less-than characters as CSS escapes when serializing stylesheet text into an HTML raw-text element. Add a restrictive script-src CSP to exported HTML and a sandbox allowing same-origin access and modals but no scripts on the print frame. Keep the parent-driven print lifecycle.

## Risks / Trade-offs

CSS escapes must preserve string semantics. Sandboxing must retain parent-controlled printing and afterprint cleanup.

## Verification

Public test seams: createDocumentExportHtml and printDocumentHtml. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
