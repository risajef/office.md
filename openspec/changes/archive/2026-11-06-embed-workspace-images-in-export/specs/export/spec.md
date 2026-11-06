## ADDED Requirements

### Requirement: Package local images in standalone exports

The system SHALL embed local workspace images into standalone HTML and print exports so they remain viewable after the application session ends. Remote HTTP(S) images SHALL retain their external URLs and SHALL not be fetched during export. Required local image failures SHALL stop export with an explanatory error.

#### Scenario: Export a workspace image

- **WHEN** a rendered document uses a blob or local filesystem bridge image
- **THEN** the exported image contains its own data URL and loads in a fresh browser context

#### Scenario: Export a remote image

- **WHEN** a document references a remote HTTP(S) image
- **THEN** export preserves the URL without requesting its bytes

#### Scenario: A local image cannot be read

- **WHEN** a required workspace image is unavailable during export
- **THEN** export fails clearly without producing a broken standalone file
