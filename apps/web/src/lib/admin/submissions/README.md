# Admin Submissions module — SOLID review pipeline

Submissions is the reference for a queue-backed list with an extracted loader and a detail workspace.

## Pipeline A — list

```
submissions/page.tsx
  → buildSubmissionsListPageModel(searchParams)
  → loadAdminSubmissionsListPage(...)
    → controller + summary + enrichment
  → CatalogListShell + AdminSubmissionsBoard
```

## Pipeline B — detail

```
submissions/[id]/layout.tsx
  → SubmissionDetailShell
  → tab routes fetch readers
  → submission view models
  → detail-board presentation
```

## Layer rules

- URL parsing and chip hrefs live in the page model.
- The loader owns row enrichment, totals, and degraded list behavior.
- Review/decision view models contain presentation decisions; tabs only compose.
- `SUBMISSIONS_ACCESS` gates browsing and mutations; action-level checks remain mandatory.
- SLA, queue age, priority, and quality labels flow through shared presenters.
- Documents remain outside catalog-media primitives because their security/review contract differs.

## UX contract

- Title/drawer and row/detail navigation must have distinct accessible labels.
- Queue age and assignment KPIs preserve their semantic compare hints when flat trends are applied.
- Decision actions expose pending, failure, and successful completion states.
- Empty, filtered-empty, read-only, and partial enrichment failures remain non-destructive.

## Verification

- Page model, loader, KPI, quality, assignment, and decision resolver tests.
- Board permission and drawer-navigation tests.
- Playwright decision/convert flow, mobile bulk actions, axe, and visual-state coverage.
