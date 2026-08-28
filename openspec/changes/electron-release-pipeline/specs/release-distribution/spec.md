## Purpose

This capability makes the Electron desktop application available as downloadable, versioned Linux and Windows packages through GitHub Releases.

## ADDED Requirements

### Requirement: Build platform packages for version tags

The release pipeline SHALL run for a stable semantic-version tag in the form `vMAJOR.MINOR.PATCH` and SHALL build one x64 Linux AppImage and one x64 Windows NSIS installer for the Electron application. The package version SHALL equal the version in the tag, and each artifact name SHALL identify the application, version, platform, and architecture.

#### Scenario: A matching version tag is pushed

- **WHEN** tag `v1.2.3` is pushed and the application package version is `1.2.3`
- **THEN** the pipeline produces `office.md-1.2.3-linux-x64.AppImage` and `office.md-1.2.3-windows-x64.exe`

#### Scenario: A non-release ref is pushed

- **WHEN** a branch, pull request, or tag that does not match `vMAJOR.MINOR.PATCH` is pushed
- **THEN** this release pipeline does not publish a GitHub Release or release assets

#### Scenario: The tag and package versions differ

- **WHEN** a matching version tag is pushed but its version does not equal the application package version
- **THEN** the pipeline fails before publishing a GitHub Release

### Requirement: Gate publication on validation and complete packaging

The release pipeline SHALL pass the repository's relevant tests, production builds, Electron build, and OpenSpec validation before publishing. It SHALL collect successful Linux and Windows packages before publication and SHALL not expose a published release containing only a subset of the required platform assets.

#### Scenario: Repository validation fails

- **WHEN** a required test, production build, Electron build, or specification validation command fails
- **THEN** the release pipeline fails and does not publish the tagged release

#### Scenario: One platform package fails

- **WHEN** the Linux or Windows packaging job fails for a valid version tag
- **THEN** the release is not published and no incomplete release is made available for download

### Requirement: Publish both packages to a GitHub Release

After all release checks and packaging jobs succeed, the pipeline SHALL create a published GitHub Release for the exact version tag and attach both platform packages as downloadable release assets. Re-running the pipeline for the same tag SHALL replace matching generated assets rather than create a second release for that tag.

#### Scenario: A release completes successfully

- **WHEN** validation passes and both platform packages are available for tag `v1.2.3`
- **THEN** the GitHub Release for `v1.2.3` is published and its assets include the Linux AppImage and Windows installer

#### Scenario: A release is retried

- **WHEN** the release pipeline is run again for an existing version tag
- **THEN** the corresponding GitHub Release is updated with the generated platform assets and no duplicate release for the tag is created

### Requirement: Published packages launch the Electron application

Each published package SHALL contain the production renderer and Electron desktop shell required to launch office.md on its target x64 platform without the repository checkout or a separately installed Node.js runtime.

#### Scenario: A user launches the Linux download

- **WHEN** a user downloads the published x64 Linux AppImage and launches it on a compatible Linux desktop
- **THEN** the office.md Electron application opens and provides its supported desktop workspace experience

#### Scenario: A user installs the Windows download

- **WHEN** a user runs the published x64 Windows installer and starts the installed application
- **THEN** the office.md Electron application opens and provides its supported desktop workspace experience
