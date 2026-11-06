## Context

Browser-folder writes recreate an externally deleted root document before checking whether it was previously known.

## Goals / Non-Goals

The system SHALL report a conflict when a previously known browser-folder document is deleted externally, without recreating it until the user explicitly keeps the local version.

Non-goals: Changes to the conflict dialog or new-file naming.

## Decisions

Reject a missing known file before calling getFileHandle with create:true. Existing conflict resolution refreshes the snapshot before an explicit keep-local write, making recreation deliberate.

## Risks / Trade-offs

New document creation must remain available; tests cover both rejection and explicit recreation.

## Verification

Public test seams: browser-folder WorkspacePort. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
