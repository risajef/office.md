## ADDED Requirements

### Requirement: Bound portable include expansion

Portable Markdown creation SHALL stop with an explanatory error before include expansion exceeds 32 nested includes or 10 MiB of UTF-8 output. Missing and cyclic includes SHALL retain their existing literal-marker behavior within those budgets.

#### Scenario: Includes multiply output

- **WHEN** repeated acyclic includes would exceed the output budget
- **THEN** export fails clearly without constructing the oversized result

#### Scenario: Includes are too deep

- **WHEN** a chain would exceed the include depth budget
- **THEN** export fails clearly instead of exhausting the call stack

#### Scenario: Includes are unresolved or cyclic

- **WHEN** an include is unresolved or repeats an ancestor
- **THEN** the literal include marker is preserved as before
