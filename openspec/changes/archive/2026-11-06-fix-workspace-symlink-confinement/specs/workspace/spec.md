## ADDED Requirements

### Requirement: Reject symlink workspace targets

The system SHALL reject workspace read and mutation requests whose target or any existing path component below the selected root is a symbolic link, including both rename endpoints and new file parents.

#### Scenario: Read through a symlink

- **WHEN** a requested file traverses a symlink below the selected root
- **THEN** the request is rejected without disclosing outside contents

#### Scenario: Mutate through a symlink

- **WHEN** a write, rename, directory creation or deletion targets a symlink or traverses one
- **THEN** the operation is rejected and outside content remains unchanged
