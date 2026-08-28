## Context

See `proposal.md` for the distribution problem and user-visible scope. The repository already has a Vite renderer, a CommonJS Electron build emitted below `dist-electron/`, the Electron entry point declared in `package.json`, and an existing Electron launch smoke test. It has no desktop packager, package metadata for release targets, or GitHub Actions workflow.

The release path must preserve the existing shared renderer and secure preload boundary. The repository uses Node 20+, npm lockfile installs, and OpenSpec/TDD validation; the workflow therefore needs to build from a clean checkout and keep packaging separate from the application runtime.

## Goals / Non-Goals

**Goals:**

- Reuse the existing Electron build output and produce native x64 packages for the two requested operating systems.
- Make release creation deterministic from a `vMAJOR.MINOR.PATCH` tag and fail early when repository metadata is inconsistent.
- Separate validation, platform packaging, and GitHub publication so one platform failure cannot publish a partial release.
- Exercise the package contents and document a local equivalent of the CI packaging command.

**Non-Goals:**

- Introducing a second renderer build or changing the Electron IPC/workspace boundary.
- Adding signing credentials, notarization, update feeds, or a release server.
- Supporting macOS, ARM, or other package formats in this change.

## Decisions

### Use electron-builder for native package formats

Add `electron-builder` as a development dependency and keep its configuration beside the existing Electron entry-point metadata. Configure an AppImage target for Linux x64 and an NSIS installer target for Windows x64, with explicit artifact names such as `office.md-${version}-linux-x64.AppImage` and `office.md-${version}-windows-x64.exe`. The builder must package `dist/`, `dist-electron/`, and the metadata needed by the existing `main` entry point, while retaining Electron's embedded runtime.

Electron-builder is selected over Electron Forge because the requested AppImage and NSIS targets, artifact naming, and non-publishing local builds are direct configuration concerns here; introducing Forge would add another packaging abstraction without a product benefit. Manually zipping the application is rejected because it would not provide the requested Linux executable package and Windows installer experience.

### Build on native GitHub-hosted runners

Use a release workflow with a validation job followed by a packaging matrix: `ubuntu-latest` builds the Linux AppImage and `windows-latest` builds the Windows NSIS installer. Each matrix job installs from `package-lock.json`, runs the existing Electron build, invokes the packager with publishing disabled, and uploads exactly its expected file as a workflow artifact. Native runners avoid relying on Wine or cross-platform packaging behavior for the first supported distribution path.

### Treat the version tag and package metadata as one release identity

The workflow will accept only `vMAJOR.MINOR.PATCH` tags. A small tested release-version seam will normalize the tag and compare it with `package.json` before any packaging or release write. The packager will therefore use the checked-in application version, and artifact names and the GitHub Release tag will refer to the same version without mutating the checkout during CI.

### Stage the GitHub Release before publishing it

The publication job will depend on successful validation and both matrix jobs. It will download and verify both workflow artifacts against a small tested release-asset manifest, create or reuse the release for the exact tag as a draft, upload/replace the two named assets, and only then mark the release as published. This makes a packaging or upload failure non-downloadable and keeps retries for the same tag idempotent. The job will use the minimum repository permission needed to write release contents; package jobs will not receive release-write permission.

### Keep local packaging explicit and non-publishing

Add a package script that builds the Electron target and invokes the packager with publishing disabled. On a native Linux or Windows development host it produces the same target configuration as the corresponding matrix job; the workflow supplies the target-specific command and uploads only the expected output. Local commands never create a GitHub Release.

### Verify package startup at the packaged-app seam

Retain the current unbundled Electron smoke test for renderer and preload behavior. Add packaging-focused checks that assert both expected files are emitted, the package contains the renderer and Electron entry point, and a packaged/unpacked application can launch on each runner where practical. The release acceptance path will also confirm the generated AppImage and installed Windows application open the existing desktop smoke surface; document the lack of signing as an expected first-release limitation.

## Risks / Trade-offs

- **[Unsigned downloads may trigger OS warnings]** Windows SmartScreen and Linux desktop policies may warn users. → Keep signing and notarization explicitly out of scope, document the limitation, and use clear release notes and asset names.
- **[Native package formats vary by host distribution]** An AppImage is portable across many Linux distributions but still depends on compatible desktop/runtime assumptions. → Build the standard x64 AppImage on the supported GitHub Ubuntu runner and make the target platform explicit in the release asset name.
- **[A release upload can fail after staging]** GitHub or network failures can leave a draft or stale asset set. → Stage as a draft, verify both files before publication, use asset replacement for retries, and never publish from the platform jobs.
- **[Tag and package versions can drift]** A package built from the wrong metadata would be misleading to users. → Fail the version check before packaging and use the checked-in version for all generated artifact names.
- **[Packaging configuration can omit runtime files]** A package that builds but cannot start is not useful. → Keep the existing `main` path and `dist-electron/package.json` CommonJS boundary in the package file set and add a launch smoke check.

## Migration Plan

1. Add the packager dependency, target configuration, explicit non-publishing local package script, and tested tag/version validation seam.
2. Add packaging-focused tests and confirm the existing web/Electron builds remain unchanged.
3. Add the tag-triggered GitHub Actions workflow with validation, native packaging matrix, staged release publication, and minimal permissions.
4. Update the README/development workflow documentation with the tag convention, local command, asset names, and unsigned-download caveat.
5. Run the relevant unit tests, builds, Electron/browser smoke tests, package checks, and OpenSpec validation before using a test tag.

To roll back, disable or remove the release workflow and packaging script/configuration; existing GitHub Releases and workspace files remain untouched. No migration of user data is required.
