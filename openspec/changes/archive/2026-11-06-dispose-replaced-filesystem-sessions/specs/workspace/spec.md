## ADDED Requirements

### Requirement: Dispose inactive filesystem sessions

The system SHALL release cached contents and capabilities for replaced or explicitly closed workspace sessions. A failed selection SHALL preserve the previous active session. Opening an isolated shared copy SHALL close the disk-backed workspace session.

#### Scenario: A new workspace is selected

- **WHEN** another folder has been scanned successfully
- **THEN** the previous session ID no longer authorizes reads or mutations

#### Scenario: A selection fails

- **WHEN** the new folder cannot be opened or exceeds a resource limit
- **THEN** the previous valid workspace remains usable

#### Scenario: A workspace is closed

- **WHEN** the renderer closes disk access or enters a shared copy
- **THEN** the old session is revoked and local handles and object URLs are released
