## ADDED Requirements

### Requirement: Acknowledge only persisted document revisions

The system SHALL serialize saves for each workspace document, retain dirty state when editing advances during a save, and prevent late or queued saves from updating another workspace session.

#### Scenario: Typing continues during a save

- **WHEN** the editor changes from A to B while saving A
- **THEN** only A is acknowledged and B remains dirty until B is persisted

#### Scenario: Saves overlap

- **WHEN** Store and autosave request different revisions of the same document
- **THEN** writes complete in request order

#### Scenario: The workspace changes during I/O

- **WHEN** a save completes or a queued save starts after another workspace is selected
- **THEN** the new workspace state is not modified by the old save
