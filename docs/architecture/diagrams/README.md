# Architecture diagrams

Diagrams in this folder are versioned exports — image renders that survive PR review and stay correct in historical PRs even after the live diagram has changed.

> **Status today.** All diagrams in the architecture docs are **inline mermaid** rather than versioned exports. Mermaid renders well on GitHub and in Cursor; for now, that's enough. This folder exists for the day a diagram becomes too complex for inline mermaid, or when we want a stable image for a third-party doc (a slide deck, a customer-facing security review, a partner integration guide).

## When to add a versioned diagram here

Add an exported diagram when one of these is true:

- The mermaid version of the diagram has grown beyond ~30 nodes and inline reading becomes awkward.
- The diagram is referenced from a non-GitHub surface (a PDF, a slide, an external partner) and must look the same outside the repo.
- A partner or auditor has explicitly requested a stable, immutable image of the architecture as of a specific date.

## How to add one

1. Render the mermaid (or another tool) to PNG and SVG.
2. Save both into this folder with a date- and topic-prefixed filename: `2026-05-01-trust-boundaries.png` and `.svg`.
3. Reference it from the architecture doc with a relative link.
4. When the architecture changes, do **not** overwrite the old file. Save the new render with a new date (`2026-08-15-trust-boundaries.png`) and move the previous version into `archive/` so historical PRs still resolve their links.

## Conventions

- Filename format: `YYYY-MM-DD-topic.{png,svg}`.
- Always export both PNG (for the doc) and SVG (for accessibility and resolution-independence).
- Do not delete archived diagrams. The git history is meaningful only if the renders survive.
- Link from the architecture doc using a relative path, never a raw GitHub URL.

## Why we don't do this yet

Mermaid renders fine for the diagrams we have today and is the only format that doesn't drift between code and image. The day someone asks for a static export is the day this folder fills up; until then, inline mermaid is the right answer.
