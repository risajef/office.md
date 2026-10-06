## Why

The Windows NSIS package currently installs an Electron app without office.md artwork, so Windows shows a generic application icon for the installed app. Reusing the existing office.md favicon gives the installed desktop app a recognizable identity.

## What Changes

- Give the packaged Windows application an `.ico` asset derived from the existing office.md favicon.
- Configure the Windows package so the installed application and its Windows app identity use the office.md icon.
- Keep the Linux package and the release artifact names unchanged.
- Do not redesign the office.md artwork or change the web favicon.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-distribution`: require the installed Windows application to use the office.md icon.

## Impact

The Windows icon asset, `electron-builder.json`, packaging configuration tests, and the release-distribution specification are affected. No runtime API or package dependency is required.
