## Context

Browser cache exceptions can abort editor startup and prevent the disk autosave callback from running.

## Goals / Non-Goals

The system SHALL continue startup and disk-backed editing when localStorage access or writes fail, and SHALL invoke disk persistence independently of optional browser caching.

Non-goals: Changing IndexedDB shared-copy persistence or cache scheduling.

## Decisions

Wrap storage acquisition, reads, writes and removals in a reusable safe interface. Main initialization and preferences use this boundary; the document plugin reports cache failure separately and always invokes the primary save callback.

## Risks / Trade-offs

Optional cache failures must not be reported as successful persistent browser-only saves; retain in-memory content and make cache availability observable.

## Verification

Public test seams: optional browser storage interface and browser disk autosave. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
