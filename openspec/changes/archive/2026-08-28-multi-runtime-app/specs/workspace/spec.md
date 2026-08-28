## MODIFIED Requirements

### Requirement: Support local and browser-backed folder access

The system SHALL use the local development filesystem bridge when available, SHALL use the Electron desktop filesystem capability in the desktop target, and SHALL fall back to the browser's supported local folder access when the bridge is unavailable in the web target.

#### Scenario: A local disk path is opened

- **WHEN** the user supplies a valid local, Windows, or WSL-style folder path while running the local application
- **THEN** the application opens the corresponding workspace and reports disk-backed access

#### Scenario: The local bridge is unavailable

- **WHEN** the application is hosted without the local bridge and the browser supports folder access
- **THEN** the user can open a workspace through the browser folder picker

#### Scenario: An Electron workspace is opened

- **WHEN** the user opens a valid local folder in the Electron target
- **THEN** the application opens the corresponding disk-backed workspace and exposes the same workspace browsing and mutation rules as the web target
