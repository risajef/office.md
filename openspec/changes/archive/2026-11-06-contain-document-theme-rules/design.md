## Context

Selector prefixing allows sibling targets and stylesheet imports/global rules can affect application chrome or initiate network requests.

## Goals / Non-Goals

The system SHALL restrict document theme selectors to the document subtree, remove stylesheet imports and global at-rules, reject network resource values, and remove positioning declarations capable of overlaying application chrome before applying a theme. Text, colors, borders, spacing and document typography SHALL remain supported.

Non-goals: Supporting theme-defined external fonts, animations or arbitrary interactive CSS; application layout remains owned by the app.

## Decisions

Use css-tree to parse a detached stylesheet AST, retain ordinary rules and media/supports groups, filter declarations to a documented decorative allowlist with no URL or raw values, then intersect each selector with :where(.editor-wrap,.editor-wrap *). Connect only the sanitized generated CSS.

## Risks / Trade-offs

Some previously accepted advanced theme features are deliberately removed. Existing bundled themes, CSS variables, Markdown typography and export styling require regression checks.

## Verification

Public test seams: applyDocumentTheme and real browser theme selection. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
