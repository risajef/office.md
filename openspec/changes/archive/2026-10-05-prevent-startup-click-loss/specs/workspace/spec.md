## ADDED Requirements

### Requirement: Keep startup selection actions unavailable until ready
The system SHALL keep the startup folder and file actions disabled until it can process their requests. Once enabled, activating an action SHALL begin the corresponding selection flow.

#### Scenario: Startup choice is visible while the application initializes
- **WHEN** the startup choice is visible before its selection actions can be handled
- **THEN** the folder and file actions remain disabled until the application is ready

#### Scenario: User activates a ready startup selection action
- **WHEN** the user activates the folder or file action after it becomes enabled
- **THEN** the corresponding selection flow begins and is not silently ignored
