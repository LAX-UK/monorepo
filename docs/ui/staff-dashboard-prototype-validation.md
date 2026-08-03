# Staff dashboard prototype validation

Status: **pending human gate** (2026-07-27) — queue-first hierarchy is implemented in code; representative task validation and Figma reconciliation remain open.

## Recommended layout (default)

1. Role-aware heading and capability-safe primary action (`StaffHubShell` header).
2. **Needs attention** queue (`MyQueueWidget`) ranked globally by severity and SLA.
3. Conditional **Live now** strip (`SaleroomLiveWidget` + `OnsiteSalesRadarWidget`).
4. Three to five role KPIs (`AdminTrendKpiBand` via profile registry) **below** queue/live.
5. Secondary anomalies and recent activity below the fold.
6. Compact hub shortcuts last.

Mobile preserves the same priority order: primary action and urgent count first; at most three KPI text summaries when no urgent work.

## Control variant (evidence only)

KPI-first layout remains available via widget customization (`kpi-band` order) but is not the default first-visit layout.

## Figma frames (required before green)

Create or extend canonical frames in the staff design file for:

| Frame | Desktop | Mobile |
|-------|---------|--------|
| Queue-first default | pending | pending |
| KPI-first control | pending | pending |
| Oversight / super-admin | pending | pending |
| Auction operations | pending | pending |
| Catalogue | pending | pending |
| Finance | pending | pending |
| Compliance | pending | pending |
| Service / fulfilment | pending | pending |
| Read-only | pending | pending |
| Empty / unavailable / live-sale | pending | pending |

Reuse `StaffHubShell`, `AdminTrendKpiBand`, queue, badge, and saleroom primitives — no parallel design system.

## Validation tasks (record in PR)

| Task | Metric | Status |
|------|--------|--------|
| Open most urgent queue item | time-to-first-action | pending |
| Find live sale needing intervention | completion rate | pending |
| Explain one KPI and reach source list | comprehension | pending |
| Find secondary hub destination | wrong-path rate | pending |
| Restricted role lacks forbidden CTAs | capability pass | automated partial |

Human gate: collect results from operations/catalogue, finance/compliance, and oversight representatives. **Do not mark validated until completed.**
