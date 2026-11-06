# runtime-hosts Specification

## Purpose

Define the supported web and desktop hosts for office.md so the product can be delivered in multiple runtimes while retaining one coherent editing experience.

## Requirements

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

### Requirement: Preserve startup workspace selection across runtime targets

The system SHALL provide the folder-or-file startup choice in every supported web and Electron runtime. In the web target, the startup choice SHALL additionally offer an action to start an empty project stored in browser storage. The desktop Electron target SHALL require selecting a disk-backed workspace or file (or opening a shared ZIP archive) and SHALL NOT offer the empty browser-stored workspace action. Each runtime SHALL let the user open a Markdown or CSV file with its immediate parent folder as the workspace and the selected file active, while preserving the same resulting workspace and active-file behavior.

#### Scenario: A file is opened in a supported runtime

- **WHEN** the user selects a supported Markdown or CSV file in a supported web or Electron runtime
- **THEN** that runtime opens the parent workspace and activates the selected file

#### Scenario: A folder is opened in a supported runtime

- **WHEN** the user opens the same folder through a supported web or Electron runtime
- **THEN** the first editable Markdown or CSV file in the workspace file view's visible order becomes active, or no document is active if the folder contains none

#### Scenario: Startup in the web target offers an empty project option

- **WHEN** the application starts in the web target
- **THEN** the startup screen presents the option to start a new empty project stored in browser storage alongside the folder and file selection options

#### Scenario: Startup in the Electron target omits the empty browser project option

- **WHEN** the application starts in the desktop Electron target
- **THEN** the startup screen does not display the option to start an empty browser-only project

### Requirement: Keep workspace files as the cross-host source of truth

The system SHALL persist supported document changes to the opened workspace files and SHALL not require a host-specific product database to transfer the current document state between supported targets.

#### Scenario: A saved document is reopened in another target

- **WHEN** the user saves a document in one supported target and opens the same workspace in the other target
- **THEN** the other target reads the saved document source from the workspace and shows the saved content

#### Scenario: A host is unavailable while files remain accessible

- **WHEN** a target cannot provide one of its preferred workspace access mechanisms
- **THEN** the system uses another supported mechanism or clearly reports that workspace access is unavailable without losing document data

### Requirement: Authorize Electron renderer capabilities

The Electron shell SHALL authorize workspace, style and share IPC only from its main application frame at the trusted application URL, block arbitrary renderer navigation and popups, and open only HTTP(S) external links in the system browser.

#### Scenario: A child or foreign frame requests disk access

- **WHEN** IPC comes from a subframe, another window or a navigated untrusted document
- **THEN** the shell rejects the request before executing the operation

#### Scenario: A document opens a link

- **WHEN** renderer navigation or a new window targets an HTTP(S) external URL
- **THEN** the shell cancels renderer navigation and opens the URL in the system browser

#### Scenario: A document requests a custom protocol

- **WHEN** a link uses a non-HTTP(S) protocol
- **THEN** the shell blocks it without invoking an external application

### Requirement: Validate host requests before executing capabilities

Host capability boundaries SHALL parse untrusted request records and validate operation-specific field types and supported size bounds before filesystem or dialog effects. Malformed requests SHALL receive deliberate validation errors rather than incidental type errors.

#### Scenario: A malformed workspace request arrives

- **WHEN** an operation has a missing or non-string session/path/content field or an invalid refresh flag
- **THEN** dispatch rejects it before calling the filesystem

#### Scenario: A malformed style request arrives

- **WHEN** a style operation has invalid folder or filename fields
- **THEN** dispatch rejects it with an explanatory request error

#### Scenario: A malformed archive save is requested

- **WHEN** the archive bytes are not Uint8Array, exceed 50 MiB, or the suggested filename is not a visible ZIP basename
- **THEN** the shell rejects the request before showing a save dialog
