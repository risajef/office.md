## Context

See `proposal.md` for the failure being corrected. The package configuration uses `office.md` as its product name. Electron-builder therefore emits `office.md.exe` for the Windows unpacked application, while its Linux default remains the npm package name `milkdown-minimal-editor`.

## Goals / Non-Goals

**Goals:**

- Keep the smoke check aligned with the executable names emitted by the existing platform targets.
- Protect the platform mapping with the existing packaging contract test seam.

**Non-Goals:**

- Changing `productName`, `executableName`, release asset names, or installer targets.
- Introducing runtime code or a new packaging abstraction.

## Decisions

- Update only the Windows expected executable to `office.md.exe`; retain `milkdown-minimal-editor` for Linux. This matches electron-builder's current platform behavior without changing the packaged application.
- Add a static contract assertion for both platform names in `tests/unit/electron-packaging.test.ts`. A runtime Windows package cannot be launched by the Linux unit-test host, and the existing test already protects packaging configuration contracts.
- Do not add an explicit builder `executableName`. That would alter the packaged executable rather than correct the smoke test's stale expectation.

## Risks / Trade-offs

- [Future packaging-name drift] The smoke script and builder configuration could diverge again. -> Keep the expected names in the packaging contract test and run it with the unit suite.
- [Platform-specific validation] The Linux host cannot prove the Windows binary launches. -> The release workflow continues to run the smoke command natively on Windows after packaging.

## Migration Plan

No user or release migration is required. Apply the filename correction, run the focused packaging test and available package smoke check, and revert the two implementation/test edits together if the packaging configuration changes.
