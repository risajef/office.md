## ADDED Requirements

### Requirement: Validate ordinary source changes

The repository SHALL run unit tests, web and Electron builds, specification validation and browser/Electron integration tests for branch pushes and pull requests without publishing artifacts or releases.

#### Scenario: Source is pushed or proposed

- **WHEN** a branch push or pull request updates repository source
- **THEN** CI validates the source without release publishing permissions
