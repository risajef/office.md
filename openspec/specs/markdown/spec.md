# Markdown Specification

## Purpose

Describe the rich Markdown document experience, linked content, diagrams, document styles, and page-oriented presentation.

## Requirements

### Requirement: Edit and render rich Markdown

The system SHALL let the user edit Markdown and render headings, lists, links, images, tables, checklists, code blocks, LaTeX, and Mermaid content in the document surface.

#### Scenario: Source edits rerender the document

- **WHEN** the user changes the Markdown source and commits the edit
- **THEN** the rendered document reflects the new content without replacing the surrounding editor workspace

#### Scenario: A code block language is changed

- **WHEN** the user changes a code block's programming-language label
- **THEN** the rendered block and serialized Markdown use the new language label

### Requirement: Render linked includes inline

The system SHALL interpret a standalone `![[file]]` reference to a Markdown or CSV file as linked content rendered at that position rather than as a code block.

#### Scenario: A Markdown include resolves

- **WHEN** the referenced Markdown file exists in the workspace
- **THEN** its rendered content appears inline at the include position

#### Scenario: An include is missing

- **WHEN** the referenced file does not exist
- **THEN** the document shows an explicit missing-file state and keeps the reference available for resolution

#### Scenario: The user removes an include

- **WHEN** the user activates the include's remove action
- **THEN** the rendered include disappears and its `![[file]]` reference is removed from the document source

### Requirement: Render and edit Mermaid diagrams

The system SHALL render Mermaid code blocks, allow their source to be edited, and preserve ordinary and CSV-linked Mermaid syntax in the Markdown source.

#### Scenario: An ordinary Mermaid block renders

- **WHEN** a document contains a valid Mermaid code block without a data source
- **THEN** a diagram preview is displayed and its source remains editable

#### Scenario: A CSV-linked Mermaid block renders

- **WHEN** a Mermaid block names a CSV data source
- **THEN** the preview resolves supported CSV cell references and row or column ranges and identifies the linked source

#### Scenario: A Mermaid source edit is committed

- **WHEN** the user edits a diagram source and commits it
- **THEN** the preview rerenders and the updated Mermaid source is serialized back into the document

### Requirement: Apply document-only CSS themes

The system SHALL apply a selected document CSS file to the rendered document, including document, heading, code, and diagram typography, without changing the surrounding application chrome.

#### Scenario: A document theme is selected

- **WHEN** the user applies a visible CSS theme from the workspace
- **THEN** the document presentation changes and the theme selectors are scoped to the document surface

### Requirement: Support document layouts and page breaks

The system SHALL support continuous, paged-document, and presentation layouts with configurable page format and margins, and SHALL treat a thematic break between content as a forced page break in paged layouts.

#### Scenario: The layout mode changes

- **WHEN** the user selects continuous, document, or presentation mode
- **THEN** the document surface and available page controls reflect the selected mode

#### Scenario: A forced page break is present

- **WHEN** a Markdown document contains a thematic break followed by more content in a paged mode
- **THEN** the content after the break begins on a new page and the page count reflects the break
