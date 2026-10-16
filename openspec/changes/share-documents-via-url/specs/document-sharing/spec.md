## Purpose

Lets users share one editable Markdown document or CSV spreadsheet, or a complete workspace, as an independent copy. Web shares are self-contained URLs; packaged Electron shares are ZIP archives. Web links and Electron archives can be password-protected.

## ADDED Requirements

### Requirement: Choose between sharing a file and a workspace

The system SHALL provide separate `Share File` and `Share Workspace` actions. `Share File` SHALL include only the active Markdown or CSV document. Every `Share Workspace` action SHALL list every relative path that will be included before creating the share.

The workspace share SHALL include visible supported files from the active workspace, preserving relative paths and the latest in-app content, including unsaved edits. It SHALL exclude hidden, ignored, unsupported, generated, and inaccessible content, consistent with the workspace view.

#### Scenario: Review a workspace share

- **WHEN** the user chooses `Share Workspace`
- **THEN** the system shows the complete list of relative paths and lets the user continue or cancel

#### Scenario: Share a workspace with includes and formulas

- **WHEN** the user shares a workspace containing Markdown includes and CSV formulas
- **THEN** the share preserves the files and relative paths so includes still resolve, and the CSV source still contains its formulas

#### Scenario: Share a workspace with unsaved edits

- **WHEN** the active workspace contains Markdown or CSV edits that have not been stored to disk
- **THEN** the workspace share contains the current in-app edits for those files

### Requirement: Share one portable document

`Share File` SHALL include only the active Markdown document or CSV spreadsheet, including its current unsaved edits. A Markdown share SHALL use the application's portable Markdown representation, materializing resolvable includes and CSV-linked Mermaid values. A CSV share SHALL preserve its editable CSV source, including formulas, rather than substituting evaluated formula values. The share SHALL include the file name and kind but SHALL NOT include a workspace path.

#### Scenario: Share a Markdown document with unsaved edits

- **WHEN** the user shares an active Markdown document with edits that have not been stored to disk
- **THEN** the share contains those edits before applying the portable Markdown conversion

#### Scenario: Share Markdown with includes

- **WHEN** the user shares a Markdown document that has resolvable includes
- **THEN** the shared Markdown materializes those includes using the portable Markdown behavior

#### Scenario: Share CSV with formulas

- **WHEN** the user shares a CSV spreadsheet containing formula cells
- **THEN** the shared CSV contains the formula source rather than only evaluated values

#### Scenario: Share an unsupported active file

- **WHEN** the active file is not Markdown or CSV
- **THEN** `Share File` is unavailable

### Requirement: Encode web shares and select compression by final URL length

In the web app, the system SHALL create a versioned URL containing all data needed to open the chosen file or workspace share. It SHALL try a compressed and an uncompressed encoding and SHALL select the compressed representation only when the complete resulting URL is shorter. The payload SHALL identify its version, share kind, and compression state. Opening a supported compressed share SHALL decompress it before opening the content.

The system SHALL warn when a generated file or workspace URL exceeds 8,000 characters and SHALL allow the user to continue or cancel. The warning SHALL explain that some destinations may truncate or reject a long URL. The system SHALL impose a 50 MiB maximum decoded share payload and SHALL stop decompression before the limit is exceeded.

#### Scenario: Compression shortens a web share URL

- **WHEN** compressing and encoding a web share produces a shorter complete URL
- **THEN** the system uses the compressed payload and marks it as compressed

#### Scenario: Compression does not shorten a web share URL

- **WHEN** compressing and encoding a web share does not produce a shorter complete URL
- **THEN** the system uses the uncompressed payload

#### Scenario: Open a compressed web share

- **WHEN** the recipient opens a supported compressed share URL
- **THEN** the system decompresses the payload and opens the original file or workspace content

#### Scenario: Review a long file or workspace URL

- **WHEN** the generated URL exceeds 8,000 characters
- **THEN** the system shows its length and a warning, and lets the user copy it or cancel

#### Scenario: A compressed payload exceeds the decoded-data limit

- **WHEN** decompression would exceed 50 MiB of decoded share payload
- **THEN** the system stops decompression and explains that the share is too large to open

### Requirement: Protect web shares with a password

The system SHALL let the user optionally protect a web share with a password using Web Crypto AES-GCM and a PBKDF2-derived key. The password SHALL NOT be included in the URL. Sensitive shared data, including workspace paths and file names, SHALL be inside the encrypted payload. Cryptographic parameters and non-sensitive format metadata SHALL be versioned and authenticated. Password protection SHALL be unavailable where browser cryptography is unavailable because the page is not in a secure context.

#### Scenario: Open a protected web share

- **WHEN** the recipient opens a protected URL
- **THEN** the system requests the password before revealing the file or workspace contents

#### Scenario: Enter the correct password

- **WHEN** the recipient enters the password used to create the link
- **THEN** the system decrypts and opens the shared content

#### Scenario: Enter a wrong password or open altered encrypted data

- **WHEN** the recipient enters a wrong password or the encrypted data has been altered
- **THEN** the system reports that the share cannot be decrypted and opens no partial or corrupted content

#### Scenario: Request password protection in an insecure context

- **WHEN** the user requests password protection where Web Crypto is unavailable
- **THEN** the system disables password protection and explains that a secure browser context is required

### Requirement: Package Electron shares as ZIP archives

In packaged Electron, the system SHALL create a ZIP archive instead of a URL. A file archive SHALL contain one portable Markdown document or formula-preserving CSV. A workspace archive SHALL preserve the relative paths and files listed in the workspace review. Every archive SHALL contain a versioned hidden manifest identifying it as an office.md shared file or workspace; the sender SHALL be told that the archive includes this metadata entry separately from the workspace content list, and the manifest SHALL NOT appear as a workspace document when the archive is opened. The system SHALL offer optional password protection for the archive. Packaged Electron SHALL open a shared ZIP directly as an isolated editable copy, requesting the password when needed. The recipient may also extract the archive with an external archive utility.

#### Scenario: Package one file in Electron

- **WHEN** the user chooses `Share File` in packaged Electron
- **THEN** the system creates a ZIP containing the portable Markdown document or formula-preserving CSV

#### Scenario: Package a workspace in Electron

- **WHEN** the user reviews and confirms `Share Workspace` in packaged Electron
- **THEN** the system creates a ZIP with the reviewed workspace files and their relative paths

#### Scenario: Protect an Electron ZIP with a password

- **WHEN** the user enables optional archive password protection
- **THEN** the ZIP requires that password to extract, and the password is not written into the archive

#### Scenario: Open a shared ZIP in Electron

- **WHEN** the user selects a ZIP with a supported office.md share manifest in packaged Electron
- **THEN** the app reads the archive, requests its password when encrypted, and opens its document or workspace as an isolated editable copy

#### Scenario: Open an extracted archive with an external archive utility

- **WHEN** the recipient extracts a shared ZIP with an archive utility
- **THEN** the document or workspace files are available with the relative paths from the archive

#### Scenario: Reject an unsafe or oversized shared ZIP

- **WHEN** the selected ZIP contains an unsafe path or more than 50 MiB of decoded content
- **THEN** the app rejects it with an explanatory error and does not open its contents

### Requirement: Open web shares as isolated editable copies

The system SHALL open a valid web share as an isolated editable file or workspace without opening, replacing, or writing to another disk-backed workspace. The system SHALL preserve each received share as a separate local browser copy across reloads. Editing SHALL NOT change the URL that opened the share or the sender's source. The recipient SHALL be able to create a new share or use supported export actions to retain changes.

#### Scenario: Open a valid file share at startup

- **WHEN** the web app starts with a valid file share URL
- **THEN** it opens the shared document directly before the normal folder-or-file startup choice

#### Scenario: Open a valid workspace share at startup

- **WHEN** the web app starts with a valid workspace share URL
- **THEN** it opens the shared files directly as an isolated workspace with their relative paths

#### Scenario: Edit shared content

- **WHEN** the recipient edits a shared file or workspace
- **THEN** the changes stay in the isolated shared copy and do not write into another workspace or update the original URL

#### Scenario: Resume a share after editing

- **WHEN** the recipient reloads or reopens the same share after editing its copy
- **THEN** the system resumes that recipient's separate local copy without changing the link or sender's source

#### Scenario: Browser storage cannot persist a shared copy

- **WHEN** the browser cannot save a shared copy because storage is unavailable or full
- **THEN** the system explains that the copy is temporary and keeps it editable in the current session with share and export actions available

#### Scenario: Open malformed or unsupported share data

- **WHEN** the URL contains malformed data or a share version the app does not support
- **THEN** the system displays an explanatory error and does not silently open another workspace
