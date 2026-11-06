## ADDED Requirements

### Requirement: Keep disk editing independent of browser cache

The system SHALL continue startup and disk-backed editing when localStorage access or writes fail, and SHALL invoke disk persistence independently of optional browser caching.

#### Scenario: Browser storage is blocked

- **WHEN** localStorage access throws at startup
- **THEN** the workspace selection and editor remain available

#### Scenario: Browser storage is full

- **WHEN** cache writes fail while a disk document is edited
- **THEN** autosave still writes the latest document to the authorized workspace
