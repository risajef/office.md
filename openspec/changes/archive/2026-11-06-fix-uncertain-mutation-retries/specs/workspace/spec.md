## ADDED Requirements

### Requirement: Do not repeat uncertain filesystem mutations

The system SHALL report a failed or uncertain mutation without reopening the workspace and repeating that mutation automatically. Subsequent reload and conflict reconciliation SHALL remain available.

#### Scenario: A write response is lost

- **WHEN** the local bridge write fails at the transport boundary
- **THEN** the adapter reports failure and sends no second write or automatic open request

#### Scenario: An image write response is lost

- **WHEN** image creation has an uncertain result
- **THEN** the adapter does not create a second image automatically
