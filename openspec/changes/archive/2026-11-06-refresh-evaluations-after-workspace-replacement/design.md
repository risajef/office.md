## Context

Replacing renderer workspace files clears evaluated CSV outputs but retains input markers, so reopening the same path may incorrectly skip formula evaluation.

## Goals / Non-Goals

The system SHALL regenerate evaluated CSV values after workspace replacement whenever the evaluated output is unavailable, even when source text matches a previously evaluated input.

Non-goals: Changes to formula semantics or the workspace scan cache.

## Decisions

Require both a matching input marker and a present evaluated output before skipping evaluation. Use an additional non-active CSV file to test the path that spreadsheet activation cannot mask.

## Risks / Trade-offs

Reopening a workspace legitimately recomputes evaluated values; unchanged background refreshes still reuse existing outputs.

## Verification

Public test seams: browser workspace reopening and live CSV includes. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
