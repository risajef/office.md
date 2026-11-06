## Context

Raw and included HTML can retain executable URLs because handwritten checks do not match browser parsing.

## Goals / Non-Goals

The system SHALL remove executable content, event handlers, unsafe URL schemes, and embedded browsing contexts from raw HTML in direct previews, includes, and exports while preserving ordinary document markup.

Non-goals: Theme CSS containment or changes to the stored Markdown source.

## Decisions

Use DOMPurify with HTML and SVG profiles at createHtmlPreviewFragment, preserving the existing blocked browsing-context tags. All previews/includes share this function; export clones sanitized DOM.

## Risks / Trade-offs

A maintained sanitizer introduces a direct dependency; keep supported rich document markup and source editing behavior.

## Verification

Public test seams: createHtmlPreviewFragment and materializeHtmlContent. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
