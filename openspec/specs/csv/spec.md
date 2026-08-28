# CSV Specification

## Purpose

Describe CSV parsing, spreadsheet editing, formula behavior, and CSV-backed data expansion.

## Requirements

### Requirement: Parse and serialize CSV safely

The system SHALL parse quoted commas, escaped quotes, multiline fields, CRLF line endings, trailing empty cells, and ragged rows, and SHALL serialize values with the quoting required to preserve their meaning.

#### Scenario: Quoted and multiline values are parsed

- **WHEN** CSV source contains commas, escaped quotes, or line breaks inside quoted fields
- **THEN** each field is returned as one cell with its intended value

#### Scenario: Ragged input becomes a rectangular sheet

- **WHEN** CSV rows have different widths or the source is empty
- **THEN** the editable sheet has a stable rectangular shape with empty cells where values are absent

#### Scenario: Values are serialized

- **WHEN** a cell contains a comma, quote, or line break
- **THEN** the stored CSV quotes and escapes that cell so a subsequent parse preserves it

### Requirement: Edit spreadsheet values and formulas

The system SHALL provide a spreadsheet editor with cell editing and row or column actions, SHALL retain formula expressions in editable and stored source, and SHALL expose evaluated values for previews and exports.

#### Scenario: A formula is edited

- **WHEN** the user enters a formula in a CSV cell
- **THEN** the raw cell value remains the formula while the displayed or queried processed value is evaluated

#### Scenario: A row action is used

- **WHEN** the user inserts, deletes, or sorts rows or columns through the spreadsheet controls
- **THEN** the editable table changes and the resulting CSV source represents the new table

### Requirement: Expand CSV references for Mermaid

The system SHALL resolve supported CSV cell references and xychart row or column ranges for CSV-linked Mermaid diagrams while preserving missing or empty references when no value is available.

#### Scenario: A cell reference resolves

- **WHEN** a linked Mermaid source references a populated CSV cell
- **THEN** the rendered source retains the Mermaid identifier and adds the escaped CSV value as its label

#### Scenario: A numeric series range resolves

- **WHEN** a linked Mermaid xychart contains a numeric line or bar range
- **THEN** the range becomes Mermaid numeric values and carries a series label only on the first value when a label is available

#### Scenario: A range contains a blank value

- **WHEN** a numeric CSV range contains a blank entry
- **THEN** that entry is materialized as zero for the chart while unavailable references remain unchanged

### Requirement: Convert CSV data to a Markdown table

The system SHALL convert CSV data into a rectangular Markdown table while escaping pipe characters and line breaks in cells.

#### Scenario: CSV is converted

- **WHEN** CSV data is requested as a Markdown table
- **THEN** the first row becomes the header, a divider row is added, and every remaining row is represented with escaped cell values
