## MODIFIED Requirements

### Requirement: Render and edit Mermaid diagrams

The system SHALL render Mermaid code blocks, allow their source to be edited, and preserve ordinary and CSV-linked Mermaid syntax in the Markdown source. When a Mermaid source is invalid, the system SHALL show an explicit rendering error within that diagram's preview without adding rendered error content outside the document surface.

#### Scenario: An ordinary Mermaid block renders

- **WHEN** a document contains a valid Mermaid code block without a data source
- **THEN** a diagram preview is displayed and its source remains editable

#### Scenario: A CSV-linked Mermaid block renders

- **WHEN** a Mermaid block names a CSV data source
- **THEN** the preview resolves supported CSV cell references and row or column ranges and identifies the linked source

#### Scenario: A Mermaid source edit is committed

- **WHEN** the user edits a diagram source and commits it
- **THEN** the preview rerenders and the updated Mermaid source is serialized back into the document

#### Scenario: An invalid Mermaid source fails inside its preview

- **WHEN** a Mermaid diagram contains invalid syntax
- **THEN** the document shows the rendering error inside that diagram's preview and no separate Mermaid error content appears below or outside the document surface
