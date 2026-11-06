## ADDED Requirements

### Requirement: Keep exported styling inert

The system SHALL preserve theme styling without interpreting theme text as HTML, and SHALL disable scripts in standalone exports and print previews.

#### Scenario: A theme contains HTML closing tags

- **WHEN** a theme contains mixed-case style closing tags followed by script markup
- **THEN** export preserves the CSS string and creates no injected HTML elements

#### Scenario: Print an untrusted document

- **WHEN** the print surface loads document content
- **THEN** scripts are disabled while the application can invoke the print dialog
