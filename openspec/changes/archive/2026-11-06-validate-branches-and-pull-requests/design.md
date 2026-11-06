## Context

Subrepo validation runs only on release tags, delaying detection of ordinary source regressions.

## Goals / Non-Goals

The repository SHALL run unit tests, web and Electron builds, specification validation and browser/Electron integration tests for branch pushes and pull requests without publishing artifacts or releases.

Non-goals: Publishing releases or changing the parent website deployment workflow.

## Decisions

Add a separate push/pull_request workflow with contents:read, Node 22.22.2, npm ci, Playwright installation, unit tests, web/Electron builds, specs and xvfb browser/Electron tests. Reuse repository scripts and cancel obsolete runs per ref.

## Risks / Trade-offs

Hosted runner execution is verified by configuration review and local equivalent commands; no workflow dispatch or push is performed.

## Verification

Public test seams: GitHub workflow configuration and existing repository verification commands. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.
