## Context

Polling rereads every document and traverses directories twice, while typing synchronously serializes unrelated files and re-evaluates unchanged spreadsheets.

## Goals / Non-Goals

The system SHALL reuse unchanged document contents during background refresh, avoid whole-workspace serialization on each keystroke, and reject workspaces exceeding supported resource budgets with an explanatory error. The supported budgets SHALL be 5000 visible entries, 32 nested directories, 10 MiB per text file, and 50 MiB total text.

Non-goals: Native filesystem watchers or eliminating directory metadata polling; initial loads remain eager within explicit limits.

## Decisions

One Node traversal gathers files and folders, caching text by high-resolution stat identity; browser scanning caches File metadata. A reusable budget counts visible entries and text bytes. Debounce renderer workspace serialization and flush on pagehide/beforeunload. Cache CSV evaluation by source string and remove entries for deleted files.

## Risks / Trade-offs

Metadata polling is not a transactional filesystem snapshot. Browser timestamp/size granularity cannot distinguish all hostile same-metadata replacements; explicit Reload forces content reads. Limits are documented and errors preserve the previous workspace.

## Verification

Public test seams: Node workspace scanner, browser scanner, cache scheduler and browser refresh workflows. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
