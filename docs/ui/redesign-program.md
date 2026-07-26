# UI/UX redesign program

Phased rollout for visual and UX refresh without blocking on backend cutovers. Worker ownership, async CRM modes, and auth dedup continue on separate runbooks.

## Prerequisites (complete)

- [x] `lib/admin` → `@/components` boundary enforced in CI (`scripts/check-lib-admin-boundaries.mjs`)
- [x] Shared contracts lifted to `lib/admin/**/*.types.ts` and `lib/shell/`, `lib/organisations/`
- [x] Architecture status docs aligned with code (`docs/architecture/04-domain-events.md` is canonical for async delivery)
- [x] View-model and token conventions documented ([view-model-conventions.md](./view-model-conventions.md), [token-change-checklist.md](./token-change-checklist.md))

## Phase 1 — Marketing catalogue (start here)

**Scope:** Public surfaces using `MarketingCatalogHubShell` / `MarketingDetailShell`.

| Route group | Examples |
|-------------|----------|
| Home + hubs | `/`, `/artists`, `/sales`, `/categories` |
| Detail | Artist, sale, lot PDP (partial layout per [marketing-design-language.md](../marketing-design-language.md)) |

**Constraints:**

- Follow [marketing-design-language.md](../marketing-design-language.md) for aspect ratios, motion, overlay tone
- Run axe smoke: `pnpm --filter @auction/web test:e2e:stabilization` (marketing subset in CI weekly)
- Refresh visual baselines after stable mockups: `pnpm ci:visual-baseline`

**Out of scope for Phase 1:** Full lot PDP artwork layout refactor (documented as follow-up in marketing SSOT).

## Phase 2 — Admin catalog (in progress)

**Scope:** High-volume list + detail hubs using `CatalogListShell` / `CatalogDetailShell`.

| Area | Routes |
|------|--------|
| Core catalog | Sales, lots, artists, categories, submissions, venues |
| People | Clients, staff, invitations, legal entities → `CatalogListShell` via `PeopleListShell` |
| Finance hubs | Finance home, Xero → `StaffHubShell` |
| Ops hubs | Onboarding, saleroom, event RSVPs → `StaffHubShell` |
| Queues | Finance manual review, compliance AML/SoF, condition reports, fulfilment |

**Completed in staff redesign wave:**

- Flat `AdminTrendKpiBand` (no hero wrapper) — Figma-aligned KPI bands
- `CatalogBoardCard` shared board primitive
- Deterministic seed fixtures: AML pending, SoF pending, manual-review payment, open dispute
- E2E: expanded `admin-pages-visual.spec.ts`, `admin-viewport-audit.spec.ts`, unified `e2e/helpers/auth.ts`
- Architecture: [staff-ui-architecture.md](./staff-ui-architecture.md), route-composition + legacy-shell guardrails

**Explicit exceptions (owner: staff-redesign, remove when migrated):**

| Route | Reason |
|-------|--------|
| `(platform)/artists/page.tsx` | Session guard only — inline `getServerSessionUser` until slimmed |

**Hub loaders migrated (2026-07-24):** dashboard, finance, Xero, settlement, event RSVPs — see [staff-ui-architecture.md](./staff-ui-architecture.md).

**Migration work during redesign:**

- Align remaining detail hubs to `CatalogDetailShell` tab registry
- Refresh visual baselines: `pnpm ci:visual-baseline` (requires seeded stack)
- Retire `AdminListKpiStrip` re-export after all imports removed
- Extend `lib/admin/catalog/*-table-row.ts` pattern for finance/people/compliance tables
- Split components >400 lines only when touched (see `check-web-guardrails` warnings)

## Phase 3 — Dashboard + auth

**Scope:** Buyer/seller dashboard, settings, onboarding, auth flows.

**Extra gates:**

- Expand axe coverage beyond current admin-heavy stabilization suite
- Respect [V1_PRODUCT_SPEC.md](../V1_PRODUCT_SPEC.md) (English-only, role matrix, onsite hub visibility)
- Forms: [FORMS.md](../FORMS.md), [ui/form-controls.md](../ui/form-controls.md)

## Phase 4 — Saleroom / realtime (isolated)

**Scope:** Clerk console, live bidding chrome, saleroom hub.

**Why last:** Heavy client state, WebSocket coupling, operational risk during live sales.

**Required:** Dedicated functional QA + saleroom smoke; do not merge visual-only refactors without realtime regression pass.

## Parallel tracks (non-blocking)

| Track | Owner | Doc |
|-------|-------|-----|
| Worker lifecycle cutover | Engineering/Ops | [worker-runtime-cutover.md](../runbooks/worker-runtime-cutover.md) |
| Async CRM/accounting live modes | Engineering/Ops | [async-delivery-phase-two.md](../runbooks/async-delivery-phase-two.md) |
| Security hardening (MFA, CSP enforce, webhook replay) | Platform | [07-security-model.md](../architecture/07-security-model.md) |
| PR-level E2E | Web platform | `.github/workflows/e2e-stabilization.yml` → promote subset to PR CI when stable |

## Definition of done per phase

1. Visual changes use semantic tokens only (token checklist green)
2. VM tests updated; no new `lib/admin` → `@/components` imports
3. Axe: no new critical/serious violations on touched routes
4. Visual snapshots updated or diff reviewed for intentional change
5. `pnpm ci:pre-push` green before merge to `main`
