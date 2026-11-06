## ADDED Requirements

### Requirement: Sanitize embedded HTML consistently

The system SHALL remove executable content, event handlers, unsafe URL schemes, and embedded browsing contexts from raw HTML in direct previews, includes, and exports while preserving ordinary document markup.

#### Scenario: A link uses control characters before a script scheme

- **WHEN** raw or included HTML contains an encoded control character before javascript:
- **THEN** the rendered fragment contains no executable link URL

#### Scenario: Document markup is rendered

- **WHEN** HTML contains headings, tables, safe links, comments, and event handlers
- **THEN** ordinary content remains and comments, handlers, and script elements are removed
