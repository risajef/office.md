## ADDED Requirements

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
