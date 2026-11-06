## ADDED Requirements

### Requirement: Bound workspace scanning and defer cache work

The system SHALL reuse unchanged document contents during background refresh, avoid whole-workspace serialization on each keystroke, and reject workspaces exceeding supported resource budgets with an explanatory error. The supported budgets SHALL be 5000 visible entries, 32 nested directories, 10 MiB per text file, and 50 MiB total text.

#### Scenario: An unchanged workspace refreshes

- **WHEN** file identity and modification metadata have not changed
- **THEN** text is reused without another content read

#### Scenario: A workspace exceeds its budget

- **WHEN** a scan reaches an entry, depth or text byte limit
- **THEN** selection fails clearly before loading excess text

#### Scenario: Typing updates a document

- **WHEN** multiple edits occur within the cache debounce interval
- **THEN** optional workspace caching serializes the latest state once after the interval

#### Scenario: Only one spreadsheet changes

- **WHEN** workspace reconciliation changes one CSV source
- **THEN** unchanged CSV evaluations are reused
