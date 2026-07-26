# Design system

Index for TheAlx auction UI tokens, shared primitives, and enforcement. Detailed conventions live in the linked docs below.

## Canonical sources

| Layer | Location |
|-------|----------|
| **Shared React primitives** | [`packages/ui`](../packages/ui/README.md) — shadcn (`new-york`) on Radix; 96+ components under `packages/ui/src/components/ui/` |
| **Brand identity** | [`packages/branding`](../packages/branding/src/brand-identity.ts) — obsidian, midnight, light gray, light cream; Montserrat + Outfit |
| **CSS tokens (web)** | [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) — Tailwind v4 `@theme`: semantic colors (`on-surface`, `surface-container-*`), typography, spacing, motion, dark mode |
| **Event app mirror** | [`apps/event/public/brand-tokens.css`](../apps/event/public/brand-tokens.css) — static CSS subset for Vite event surfaces |

## Token layers (web)

1. **Brand primitives** — `--color-brand-*` (obsidian, midnight, light gray, light cream)
2. **Semantic aliases** — `--color-ink`, `--color-paper`, `--color-link`, `--color-cta-*`
3. **UI / shadcn bridge** — `--color-foreground`, `--color-primary`, `--color-muted`, sidebar tokens

Email hex mirrors live in [`packages/branding/src/tokens.ts`](../packages/branding/src/tokens.ts).

## Conventions (read before building UI)

- **[Marketing design language](./marketing-design-language.md)** — marketing surface SSOT: layout, aspect ratios, saleroom chrome, overlay tone, component catalog
- **[UI redesign program](./ui/redesign-program.md)** — phased rollout order (marketing → admin catalog → dashboard → saleroom)
- **[View-model conventions](./ui/view-model-conventions.md)** — where presentation logic lives; `lib/admin` import rules
- **[Token change checklist](./ui/token-change-checklist.md)** — rebrand touch points and visual baseline commands
- **[Form controls](./ui/form-controls.md)** — `@auction/ui` pickers, RHF wrappers, native-control ban
- **[Theme mode](./web/theme-mode.md)** — light / dark / Auto resolution
- **[Forms (RHF + Zod)](./FORMS.md)** — server actions and validation patterns

## Governance policies (admin + catalog)

### Status presentation

| Context | Component | Notes |
|---------|-----------|-------|
| Operational/admin entity status | `AdminStatusBadge` + domain resolver in `lib/admin/status-badge-variants` | Canonical dot-pill for draft, active, archived, etc. |
| Marketing / public catalog | Ring badge variants in `@auction/ui` | Documented exceptions only |
| Lot auction type | `LotAuctionTypeChip` + presenter registry | Never inline status strings |

### Shell selection

| Route kind | Shell | Example |
|------------|-------|---------|
| High-volume list | `CatalogListShell` + board card (`CatalogBoardTableHeader`) | Sales, lots, artists, submissions |
| Detail hub | `CatalogDetailShell` + tab nav | Sale/lot/category detail |
| Tab board content | `DetailBoardShell` / `CatalogDetailTabCard` | Overview, press, registrations |
| Multi-step create/edit | `CatalogFormShell` + sidebar wizard | Sale/lot setup |
| Queue / finance lens | `CatalogListShell variant="queue"` | Manual payment review |
| Taxonomy tree | Board chrome + tree (not flat table) | Categories |

### Import policy

- UI primitives: `@auction/ui/components/*` (never direct `@radix-ui/*`)
- Shared list contracts: `@/lib/admin/catalog/types`, `@/lib/admin/bulk-ops/types`
- Row view models: `@/lib/admin/catalog/*-table-row.ts`
- Lib must not import `@/components/**` (enforced by `check-lib-admin-boundaries.mjs`)

### Focus treatment

- Use semantic `focus-visible:outline-ring` or shared `FOCUS_RING` constant
- Sticky catalog chrome uses `--z-sticky` (40) below site chrome (`--z-site-chrome`: 50)

### Tables

| Pattern | When |
|---------|------|
| `AdminDataTable` + `EntityList` | Default admin lists with bulk select |
| `DetailEntityTable` | Detail tab stat/audit tables |
| Category tree rows | Taxonomy — never forced into flat `AdminDataTable` |
| `DetailCardGrid` | Card galleries (press, media previews) |

## Machine enforcement (CI)

| Check | What it enforces |
|-------|------------------|
| `pnpm lint:ui-guardrails` | No raw `<button>`, native form controls, direct `@radix-ui/*`, `window.confirm` in `apps/web` |
| `pnpm lint:lib-admin-boundaries` | Blocks `lib/admin` → `@/components` imports (also in `ci:verify`) |
| `apps/web` lint | Native form controls, Query usage allowlist, session ownership |
| `packages/branding` tests | Token drift vs `globals.css`; event `brand-tokens.css` alignment |
| Playwright axe | Marketing smoke + admin a11y (WCAG 2a/2aa) |

## Adding components

1. Prefer an existing primitive from `@auction/ui/components/*`.
2. App-specific wrappers belong in `apps/web/src/components/ui/` (RHF, filters, marketing shells).
3. New shadcn components: follow [`packages/ui/README.md`](../packages/ui/README.md) (`pnpm dlx shadcn@latest add …` from `packages/ui`).
4. Do not hardcode legacy hex or fonts in component source — use semantic Tailwind tokens (`text-on-surface`, `bg-surface-container-low`, etc.).

## Client data fetching (related)

Server data default is RSC + `*.server.ts`. TanStack Query is reserved for realtime and the invitations/disputes reference lists. See `pnpm --filter @auction/web check:query-usage`.
