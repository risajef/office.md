## Context

Acyclic repeated includes can multiply portable output and deeply nested includes can exhaust the JavaScript stack.

## Goals / Non-Goals

Portable Markdown creation SHALL stop with an explanatory error before include expansion exceeds 32 nested includes or 10 MiB of UTF-8 output. Missing and cyclic includes SHALL retain their existing literal-marker behavior within those budgets.

Non-goals: Changing include resolution semantics or supported CSV formulas.

## Decisions

Pass one shared output budget through recursive expansion, charging leaf lines before adding them. Check depth before recursion. Preserve cycle detection and apply a final byte check after Mermaid CSV materialization.

## Risks / Trade-offs

Line separators and UTF-8 multibyte characters count toward the limit; exact-boundary fixtures protect accounting. Exports over the limits now fail explicitly.

## Verification

Public test seams: createPortableMarkdown. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
