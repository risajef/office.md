## Why

The Electron target can currently be built and launched locally, but users have no supported way to download a packaged desktop application. A GitHub release pipeline will turn tagged versions into downloadable Linux and Windows release assets so the desktop app can be distributed consistently.

## What Changes

- Add a release-distribution capability for the Electron desktop target.
- Build the production renderer and Electron shell in GitHub Actions on a release tag.
- Package the application for x64 Linux as an AppImage and for x64 Windows as an installer.
- Create or update the corresponding GitHub Release and attach both platform assets with stable, platform-identifying names.
- Fail the workflow when validation, packaging, or release publication fails instead of publishing a partial release.
- Document the tag convention, generated assets, and the local packaging command for maintainers.

### Non-goals

- macOS packaging or additional CPU architectures.
- Code signing, notarization, auto-update delivery, or hosting releases outside GitHub.
- Changes to the editor, workspace, Markdown, CSV, or export behavior.
- Publishing releases for arbitrary branch pushes or every pull request.

## Capabilities

### New Capabilities

- `release-distribution`: Package the Electron app for x64 Linux and Windows and publish the assets to a GitHub Release for a version tag.

### Modified Capabilities

None. The existing Electron host behavior remains unchanged; this change adds its distribution path.

## Impact

- Adds Electron packaging configuration and a GitHub Actions workflow under `.github/workflows/`.
- Adds or updates package scripts and development documentation for reproducible local packaging.
- Uses the existing `build:electron` output and Electron entry point; no new application runtime or persistence layer is introduced.
- Requires GitHub Actions permission to create releases and upload release assets.
- The initial release scope assumes x64 artifacts: a Linux AppImage and a Windows installer.
