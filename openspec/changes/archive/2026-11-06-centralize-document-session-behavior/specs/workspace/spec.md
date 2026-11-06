## ADDED Requirements

### Requirement: Keep document session state coherent

The system SHALL retain unsaved and conflicted document revisions across document navigation, use the latest editable content and evaluated CSV values for exports, and apply the same Node filesystem policy through HTTP and Electron.

#### Scenario: A dirty document is reopened

- **WHEN** navigation returns to a document whose save is pending or failed
- **THEN** loading its editor does not mark the unsaved content as persisted

#### Scenario: Export an unsaved document with evaluated CSV

- **WHEN** the document session has edits and a linked formula spreadsheet
- **THEN** the shared export pipeline uses the latest edits and evaluated CSV values

#### Scenario: Use either Node host

- **WHEN** the same workspace request reaches HTTP or Electron
- **THEN** one shared service applies confinement and write-conflict policy
