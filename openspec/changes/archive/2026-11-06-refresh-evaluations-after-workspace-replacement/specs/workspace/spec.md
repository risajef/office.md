## ADDED Requirements

### Requirement: Restore CSV evaluations after workspace replacement

The system SHALL regenerate evaluated CSV values after workspace replacement whenever the evaluated output is unavailable, even when source text matches a previously evaluated input.

#### Scenario: The same workspace is reopened

- **WHEN** a non-active formula spreadsheet is included in Markdown after reopening the same folder
- **THEN** the include displays evaluated values rather than formula source
