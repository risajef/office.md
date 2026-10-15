## ADDED Requirements

### Requirement: Reflect external workspace changes while open

The system SHALL detect visible filesystem changes while a disk-backed workspace is open in Electron, the local filesystem bridge, and browser folder access. While the application window is visible, within five seconds of a change, the workspace view SHALL reflect visible files and folders added, renamed, or removed, and cached content for modified files. When the application window becomes visible, the system SHALL refresh the workspace immediately. A newly added document SHALL NOT become active automatically. A clean active Markdown or CSV document changed on disk SHALL update from disk and the application SHALL notify the user. Monitoring failures SHALL NOT interrupt editing or discard cached content, and monitoring SHALL resume when filesystem access returns.

#### Scenario: A document or folder is created outside office.md

- **WHEN** a visible supported document or folder is created in the open workspace
- **THEN** it appears in the workspace view within five seconds without changing the active document

#### Scenario: A workspace file is renamed or removed outside office.md

- **WHEN** a visible supported file is renamed or removed in the open workspace
- **THEN** the workspace view reflects the removed path and any new visible path within five seconds

#### Scenario: A clean active document changes outside office.md

- **WHEN** an active Markdown or CSV document with no unsaved local edits changes on disk
- **THEN** the editor displays the disk contents within five seconds and the user sees that the document was updated externally

#### Scenario: A non-active document changes outside office.md

- **WHEN** a workspace document that is not active changes on disk
- **THEN** its cached contents are refreshed so opening it or using it as an include reads the disk contents without reloading the workspace

#### Scenario: Filesystem monitoring temporarily fails

- **WHEN** the runtime cannot read the workspace during a background refresh
- **THEN** editing remains available, cached workspace content is preserved, and monitoring retries after access returns

#### Scenario: The application returns to the foreground

- **WHEN** the application window becomes visible after a workspace file changed while it was hidden
- **THEN** the workspace refreshes immediately and reflects the current disk contents

### Requirement: Preserve and resolve conflicting document changes

When a document has unsaved local edits and its disk contents change or the file is removed externally, the system SHALL preserve the local editor contents and SHALL NOT overwrite either version automatically. The system SHALL visibly identify the affected document and offer explicit per-document actions to use the disk version or keep the local version. Choosing either action SHALL resolve only that document's conflict.

#### Scenario: The active document changes externally while local edits are unsaved

- **WHEN** the runtime detects an external change to a document with unsaved local edits
- **THEN** the editor keeps the local contents, leaves the disk contents unchanged, and presents actions to use the disk version or keep the local version

#### Scenario: The user chooses the disk version

- **WHEN** the user chooses to use the disk version for a conflicted document
- **THEN** that document's editor contents are replaced by the latest disk contents, or the document is closed if it was removed, and the conflict is cleared

#### Scenario: The user keeps the local version

- **WHEN** the user chooses to keep the local version for a conflicted document
- **THEN** that document's local contents are written to disk and the conflict is cleared

#### Scenario: An external deletion conflicts with local edits

- **WHEN** a document with unsaved local edits is removed from disk outside office.md
- **THEN** the local editor contents remain available and the user can explicitly recreate the file from the local version or discard it
