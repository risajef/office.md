## 1. Define and prepare share payloads

- [ ] 1.1 Add typed, versioned share records for a portable Markdown/CSV file and a workspace manifest that preserves relative paths, text source, and binary asset content; add a hidden versioned ZIP manifest for Electron archives.
- [ ] 1.2 Add public-interface coverage for current unsaved edits, portable Markdown materialization, formula-preserving CSV, workspace file enumeration, excluded files, path safety, and the complete pre-share file list; confirm the scenarios fail before implementation.

## 2. Web share URL codec

- [ ] 2.1 Add failing public-interface tests for versioned plain file/workspace round-trips, compression selection by complete URL length, explicit compressed decoding, the long-URL warning/continue flow for both share modes, and the 50 MiB decoded-data boundary.
- [ ] 2.2 Implement the versioned URL-fragment codec. Compare full raw and gzip URLs, mark compression state, warn above 8,000 characters while allowing continuation, and enforce the 50 MiB decompression bound.

## 3. Password-protected web links

- [ ] 3.1 Add failing public-interface tests for password-protected file/workspace round-trips, compression before encryption, password absence from the URL, wrong-password and tamper errors, and secure-context restrictions.
- [ ] 3.2 Implement PBKDF2-HMAC-SHA-256 and AES-256-GCM with fresh salt and IV values, authenticated envelope metadata, password confirmation, and a recipient prompt.

## 4. Isolated web startup and editing

- [ ] 4.1 Add failing startup/browser coverage for opening file and workspace shares before the normal chooser, preserving relative paths, resuming a separate local copy across reloads, re-sharing edited file/workspace copies into new URLs, handling browser storage failure, and avoiding writes to disk-backed workspaces.
- [ ] 4.2 Decode valid shares before normal workspace startup and persist isolated editable file/workspace copies separately from disk-backed workspaces. Keep share actions available and create new snapshots from the latest edits with new identifiers. If browser storage fails, keep the copy available temporarily and explain the persistence failure. Show focused errors for malformed, unsupported, oversized, or undecryptable payloads without falling back to another workspace.

## 5. Electron ZIP sharing

- [ ] 5.1 Add `@zip.js/zip.js` and create file and workspace ZIPs from the reviewed share payloads, preserving workspace paths and adding a hidden versioned share manifest.
- [ ] 5.2 Add the Electron save dialog bridge for ZIP output and optional WinZip AES-256 password protection.
- [ ] 5.3 Add `Open Share ZIP` to Electron's file selection flow, prompt for a password when needed, validate the share manifest, paths, and 50 MiB decoded-size limit, then load or resume the archive as a separate editable copy.
- [ ] 5.4 Verify produced archives open in office.md and supported extractors, encrypted archives require the password, and extracted files/workspaces open normally.
- [ ] 5.5 Verify editing a ZIP-backed copy and sharing again creates a new archive with the latest edits and a new manifest identifier without changing the opened archive.

## 6. Share controls and review

- [ ] 6.1 Add failing UI coverage for `Share File`, `Share Workspace`, listing every included workspace file, web URL length warnings for both share types, continuing or cancelling, and Electron ZIP open/save/password flows.
- [ ] 6.2 Add the two share actions, workspace file review, password inputs with confirmation, web long-link warning, Electron ZIP open/save, and status/error messages.

## 7. Final verification

- [ ] 7.1 Run `npm test`, `npm run build`, `npm run build:electron`, `npm run test:e2e`, and `npm run spec:validate`; confirm the full set passes and no generated build or test output is included.
