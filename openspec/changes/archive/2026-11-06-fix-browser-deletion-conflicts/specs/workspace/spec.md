## ADDED Requirements

### Requirement: Preserve deleted files until conflict resolution

The system SHALL report a conflict when a previously known browser-folder document is deleted externally, without recreating it until the user explicitly keeps the local version.

#### Scenario: A known root document is deleted

- **WHEN** a browser-folder document is removed before the next write
- **THEN** the write raises a deletion conflict and creates no file

#### Scenario: The user explicitly recreates a document

- **WHEN** a fresh snapshot observes the missing file and the user keeps local contents
- **THEN** the write can create a new file
