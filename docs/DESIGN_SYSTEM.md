# Design system

Index for TheAlx auction UI tokens, shared primitives, and enforcement. Detailed conventions live in the linked docs below.

## Canonical sources

| Layer | Location |
|-------|----------|
| **Shared React primitives** | [`packages/ui`](../packages/ui/README.md) — shadcn (`new-york`) on Radix; 96+ components under `packages/ui/src/components/ui/` |
| **Brand identity** | [`packages/branding`](../packages/branding/src/brand-identity.ts) — obsidian, midnight, light gray, light cream; Montserrat + Outfit |
| **CSS tokens (web)** | [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) — Tailwind v4 `@theme`: semantic colors (`on-surface`, `surface-container-*`), typography, spacing, motion, dark mode; imports [`marketing-header.css`](../packages/marketing-ui/src/marketing-header.css) for shared Bid/Shop header chrome |
| **Event app mirror** | [`apps/event/public/brand-tokens.css`](../apps/event/public/brand-tokens.css) — static CSS subset for Vite event surfaces |
| **Shared CSS primitives** | [`packages/branding/public/brand-primitives.css`](../packages/branding/public/brand-primitives.css) — importable brand hex + font roles |
| **Shop storefront** | [`apps/shop`](../apps/shop) — Figma `1:651` layout; see [Shop storefront architecture](./ui/shop-storefront-architecture.md) |
| **Identity hosted login** | [`packages/auth/src/hosted-auth/styles.ts`](../packages/auth/src/hosted-auth/styles.ts) — Bid-equivalent floating-label underline fields, 528px column, 44px controls; served at `auth…/hosted-auth.css` |
| **Ecosystem contracts** | [`packages/lax-ecosystem`](../packages/lax-ecosystem) — product directory, account chrome VMs, LAX Account v1 DTOs; see [architecture/11](./architecture/11-lax-ecosystem-boundary.md) |

## LAX ecosystem UX

Bid and Shop remain **purpose-built products** with recognizable shared DNA:

| Element | Shared contract | Product-owned |
|---------|-----------------|---------------|
| Product naming | “LAX Bid”, “LAX Shop” in switcher and footers | Primary nav, mega-menu, commerce rails |
| Account entry | Guest vs signed-in header; `/account` on Shop; Bid account chip | Account page layout beyond identity summary |
| Product switcher | Validated env URLs via `@auction/lax-ecosystem` | Placement inside each header utility row |
| Focus / targets | `FOCUS_RING` from `@auction/branding`; 44×44 minimum interactive targets | BEM vs Tailwind composition |
| Loading / errors | Discriminated account states (`unavailable` ≠ guest) | Product-specific error copy |

Wayfinding must use configuration (`LAX_BID_PUBLIC_URL`, `LAX_SHOP_STOREFRONT_URL`), not hardcoded production hosts in components.

## Multi-product UI stack

LAX products share identity, branding, and ecosystem contracts; each product keeps its own navigation, density, and catalogue patterns. **Apple-like** here means one relationship and recognizable DNA—not one shared header or a single component library everywhere.

| Layer | Bid (`apps/web`) | Shop (`apps/shop`) |
|-------|------------------|---------------------|
| Storefront / marketing shell | Custom sections + tokens ([marketing design language](./marketing-design-language.md)); shadcn where controls are needed | Figma-owned section layout in `home.css` + shared `@auction/marketing-ui` card chrome (hover, focus, reveal) |
| Dense interaction (admin, forms, checkout) | `@auction/ui` (shadcn New York) default | Same primitives **selectively** on account, auth recovery, and future bag/checkout |
| Chrome | Auction mega-nav + saleroom | Product-owned header/footer + `@auction/lax-ecosystem` switcher |

**Three-layer token contract** (DTCG-aligned):

1. **Primitives** — [`brand-primitives.css`](../packages/branding/public/brand-primitives.css), Montserrat + Outfit.
2. **Semantic roles** — link, surface, focus ring (`@auction/branding` / product CSS vars).
3. **Product mapping** — Bid Tailwind `@theme` + full shadcn bridge in `apps/web/src/app/globals.css`; Shop BEM storefront + a **narrow shadcn bridge** in `apps/shop/src/app/globals.css` for `@auction/ui` on interactive surfaces.

| Surface | Shop approach |
|---------|----------------|
| Home rails, hero, cards | `@auction/marketing-ui` shells + Shop BEM sizing; data from `shop-api` via Next BFF composer |
| Header/footer, switcher | Product-owned + ecosystem VMs |
| Account, login/register entry, session errors | `@auction/ui` Button, Alert — shared interaction, Shop-owned layout (`shop-account-shell`) |
| Bag, checkout, filters (future) | shadcn + RHF per [Forms (RHF + Zod)](./FORMS.md) |
| Placeholder `#` marketing links | No fake chrome until routes exist |
| Missing catalogue media | `@auction/ui` `MediaPlaceholder` (diagonal hatch) via `@auction/marketing-ui` `MediaImage` / Shop wrappers |
| Entity status chips | `@auction/ui` `DotStatusPill` + semantic tokens (`success`, `info`, `warning`, `danger`, `live-red`); registries emit **tones**, not ad hoc Tailwind colours |

**Explicit non-goals:** one shared header across Bid and Shop; importing `apps/web` into Shop (see `scripts/check-layers.mjs`). Bid migration onto `@auction/marketing-ui` is deferred; Shop adopts the package first.

New products (e.g. Artist Growth) add a row to `@auction/lax-ecosystem` product directory and their own Figma-owned layout—they do not fork Bid or Shop repos.

## Token layers (web)

1. **Brand primitives** — `--color-brand-*` (obsidian, midnight, light gray, light cream)
2. **Semantic aliases** — `--color-ink`, `--color-paper`, `--color-link`, `--color-cta-*`
3. **UI / shadcn bridge** — `--color-foreground`, `--color-primary`, `--color-muted`, sidebar tokens

Email hex mirrors live in [`packages/branding/src/tokens.ts`](../packages/branding/src/tokens.ts).

## Conventions (read before building UI)

- **[Marketing design language](./marketing-design-language.md)** — marketing surface SSOT: layout, aspect ratios, saleroom chrome, overlay tone, component catalog (includes **Shop profile**)
- **[Shop storefront architecture](./ui/shop-storefront-architecture.md)** — Shop layers, shared LAX contract, Figma-owned composition
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
