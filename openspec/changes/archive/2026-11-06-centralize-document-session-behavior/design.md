## Context

Renderer-owned dirty/clean/conflict maps and duplicate export/Node filesystem paths let behavior diverge across UI and hosts.

## Goals / Non-Goals

The system SHALL retain unsaved and conflicted document revisions across document navigation, use the latest editable content and evaluated CSV values for exports, and apply the same Node filesystem policy through HTTP and Electron.

Non-goals: Rewriting the UI framework or eliminating the deliberate distinction between editable session contents and last observed disk snapshots.

## Decisions

Make session persistence state private behind methods and combine it with the revision-aware save controller. Navigation must not reset dirty state. Construct a shared export application from current document suppliers, including evaluated CSV data. Move filesystem implementation to node/ and keep transport adapters thin; retain compatibility re-exports for existing Electron test seams.

## Risks / Trade-offs

Refactoring must preserve active editor normalization, include name resolution, CSV formulas and HTTP asset response types. Existing browser workflows and real filesystem tests guard these contracts.

## Verification

Public test seams: document session controller, document export application, real Node services and browser workflows. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
