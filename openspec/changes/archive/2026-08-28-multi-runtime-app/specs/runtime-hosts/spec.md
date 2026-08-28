## Purpose

Define the supported web and desktop hosts for office.md so the product can be delivered in multiple runtimes while retaining one coherent editing experience.

## ADDED Requirements

### Requirement: Provide web and desktop editor targets

The system SHALL provide a browser-based web target and an Electron desktop target, and each target SHALL expose the supported workspace, Markdown, CSV, and export experience.

#### Scenario: The web target is opened

- **WHEN** a user opens the web target in a supported browser
- **THEN** the user can access the office.md editor and its supported workspace, document, spreadsheet, and export actions

#### Scenario: The Electron target is opened

- **WHEN** a user starts the Electron target
- **THEN** the user can access the same office.md editor experience in a desktop window with disk-backed workspace access

### Requirement: Preserve shared behavior across hosts

The system SHALL apply the same Markdown, CSV, include, rendering, export, and workspace safety rules in the web and Electron targets; host-specific differences SHALL be limited to runtime capabilities and packaging behavior.

#### Scenario: The same Markdown source is edited in both targets

- **WHEN** the user opens the same Markdown source in the web target and the Electron target and performs the same supported edit
- **THEN** both targets produce the same resulting Markdown source and document behavior

#### Scenario: The same CSV formula is edited in both targets

- **WHEN** the user enters a formula into the same CSV cell in the web target and the Electron target
- **THEN** both targets retain the formula in source and expose the same evaluated value for display and export

#### Scenario: The same workspace mutation is attempted in both targets

- **WHEN** the user attempts an unsafe path, overwrite, or non-empty-directory deletion in either target
- **THEN** the operation is rejected under the same workspace safety rules and existing content remains unchanged

### Requirement: Keep workspace files as the cross-host source of truth

The system SHALL persist supported document changes to the opened workspace files and SHALL not require a host-specific product database to transfer the current document state between supported targets.

#### Scenario: A saved document is reopened in another target

- **WHEN** the user saves a document in one supported target and opens the same workspace in the other target
- **THEN** the other target reads the saved document source from the workspace and shows the saved content

#### Scenario: A host is unavailable while files remain accessible

- **WHEN** a target cannot provide one of its preferred workspace access mechanisms
- **THEN** the system uses another supported mechanism or clearly reports that workspace access is unavailable without losing document data
