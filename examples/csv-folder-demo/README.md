# CSV workspace demo

Open `graph.csv` in the editor's Files panel to edit it as a spreadsheet.

- **Insert table** adds the CSV as a Markdown table.
- **Linked Mermaid** asks for a Mermaid template and keeps the CSV filename in
  the code fence, for example `mermaid(graph.csv)`.
- **CSV → diagram** creates a one-time flowchart from the first two columns.

In a linked diagram, bare cell references such as `A2` and `B2` are labelled
from the current CSV values whenever the diagram is rendered.
