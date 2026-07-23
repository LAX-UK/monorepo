# Admin People module — rollout contract

People and onboarding list pages use the same SOLID list pipeline as compliance and operations
while preserving identity-specific permissions, directory filters, preview workflows, and
moderation boundaries.

## Reference and rollout order

1. Invitations is the canonical People list pilot.
2. Clients and Staff share directory contracts but keep separate summaries, filters, and preview UX.
3. Legal Entities follows with authoritative Stripe/review summaries.
4. Onboarding Issues becomes a paginated triage hub after directory contracts land.

## Pipeline A — list

```
page.tsx
  → require people capability
  → load<Module>ListPage(searchParams, user?)
    → build<Module>ListPageModel(searchParams)
    → reader + strict parse*PageBody
    → serializable board model + capabilities
  → PeopleListShell / CatalogListShell + <Module>BoardContainer
```

## Rules

| Principle | People rule |
|---|---|
| SRP | Route authorizes/composes; loader fetches; page model owns URL state; board renders |
| OCP | New lens/filter behavior extends page models and query services, not shells |
| LSP | People wrappers preserve loading, error, pagination, and read-only contracts |
| ISP | Boards receive only capabilities and actions they render |
| DIP | Client boards never import HTTP readers or persistence services |

## People-specific behavior

- Directory KPI tiles must come from authoritative API summaries, never page-row filters.
- Preview/review state belongs in the URL (`?client=`, `?staff=`, `?invitation=`, `?entity=`).
- Use validated `returnTo` list context when navigating to detail workspaces.
- Binding moderation, role, invitation revoke, and lifecycle transitions stay server-guarded with explicit confirmation in the UI.
- Bulk selection and export context must survive pagination and preview open/close.

## Completion checklist

- Dedicated page model, loader, KPI builder, strict reader, and tests.
- Standard `{ data, meta: { total, limit, offset, summary } }` envelope on list endpoints.
- Compose-only routes; no page-local aggregation or capability math.
- URL-owned preview drawers with off-page selected reads where needed.
- Desktop/mobile, light/dark, permission, axe, and visual regression coverage.
