## ADDED Requirements

### Requirement: Enforce document theme policy

The system SHALL restrict document theme selectors to the document subtree, remove stylesheet imports and global at-rules, reject network resource values, and remove positioning declarations capable of overlaying application chrome before applying a theme. Text, colors, borders, spacing and document typography SHALL remain supported.

#### Scenario: A theme targets document siblings

- **WHEN** a selector uses a sibling combinator from the document root
- **THEN** no element outside the document subtree matches the installed selector

#### Scenario: A theme requests external resources or global rules

- **WHEN** CSS contains imports, font-face rules or URL values
- **THEN** those rules and values are removed before connecting the stylesheet

#### Scenario: A theme positions an overlay

- **WHEN** CSS declares fixed positioning and z-index
- **THEN** overlay positioning is removed while ordinary document styling remains
