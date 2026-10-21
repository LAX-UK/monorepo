# Design system

Index for TheAlx auction UI tokens, shared primitives, and enforcement. Detailed conventions live in the linked docs below.

## Canonical sources

| Layer | Location |
|-------|----------|
| **Shared React primitives** | [`packages/ui`](../packages/ui/README.md) — shadcn (`new-york`) on Radix; 96+ components under `packages/ui/src/components/ui/` |
| **Brand identity** | [`packages/branding`](../packages/branding/src/brand-identity.ts) — obsidian, light gray, light cream (shared), midnight (Bid accent only; see [LAX colour rule](#lax-colour-rule-one-palette-one-accent-per-product)); Montserrat + Outfit |
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

### lax.art: the "Apple model" rule

lax.art (`apps/art`) is the first product built **composition-only** on shared packages:

- **Shared behaviour, product-owned layout.** Every interactive control comes from `@auction/ui` (Button, Input, Textarea, Select, Label, Alert, Skeleton, DotStatusPill) or `@auction/marketing-ui` (heart toggle, side sheet, bottom tab bar, filter sheet/sidebar, card media). Art owns only page composition, Tailwind layout and copy.
- **No local primitives.** If Art needs a control that does not exist, it is added to the shared package (with a test) and then consumed. Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `lucide-react`, `vaul` and direct `@radix-ui/*` are rejected by `scripts/check-ui-guardrails.mjs` for `apps/art/src`.
- **Shared presenters.** Money/date formatting and portal row VMs come from `@auction/shop-portal/vm`; Art does not copy Shop presenters.
- **Theme contract.** Semantic tokens only (`apps/art/src/app/base.css`); palette utilities and raw hex outside `base.css` fail `scripts/ci/verify-art-theme.test.mjs`.
- **Layering.** `page.tsx` composes, `lib/<area>/*-page.composer.ts` orchestrates via injected ports (`lib/ports.ts`, wired in `lib/art-services.server.ts`), `*.server.ts` does I/O, `*.vm.ts` is pure and unit-tested, client islands are `*.client.tsx`.
- **Loading skeletons only on list routes.** Route skeletons live in `(home)`/`(index)` route groups; slug routes (`[slug]`) render without a `loading.tsx` above them so a missing record answers a real 404 (not a 200 soft 404) and an outage a 500. `apps/art/src/lib/seo/page-status.test.ts` enforces this.

### Primitive audit (Shop · Bid · Art)

Counts are files importing the primitive (excluding tests) at the time of the lax.art MVP pass; "—" means unused.

| Primitive | Shared package | Shop usage | Bid usage | Art usage | Notes / local duplicates |
|-----------|----------------|------------|-----------|-----------|--------------------------|
| Button | `@auction/ui/components/button` | 10 (account, auth entry) | 447 | 9 (incl. `underline` / `inline` variants for text links) | Shop storefront chrome still uses ~15 files of BEM-styled raw controls; Shop is not yet covered by the guardrails script |
| Input / Label | `@auction/ui` | — | 54 / 41 | 4 / 4 (filters, search, enquiry) | Shop forms use BEM inputs |
| Textarea | `@auction/ui` | — | 39 | 1 (enquiry) | |
| Select | `@auction/ui` | — | 27 | 1 (catalogue sort) | |
| Alert | `@auction/ui` | — | 81 | 2 (enquiry sheet and panel) | Shop renders inline notices |
| Skeleton | `@auction/ui` | — | 29 | 1 (route skeletons) | Shop has local `shop-page-skeleton` / `shop-route-loading` |
| DotStatusPill | `@auction/ui` | 10 | 32 | 1 | Registries emit tones only |
| Sheet / Dialog | `@auction/ui` | Dialog 1 | Sheet 7, Dialog 18 | via `MarketingSideSheet` | Bid has product-specific sheets (iOS install, venue drawer, admin filters) |
| Side sheet (576px desktop, bottom sheet mobile) | `@auction/marketing-ui` `MarketingSideSheet` | — | — | 2 (artwork + general enquiry) | New in this pass; Shop/Bid candidates to adopt |
| Pull quote | `@auction/marketing-ui` `MarketingPullQuote` | — | 1 (press) | 1 (editorial blocks) | Bid keeps local `pull-quote.tsx` until migrated |
| Info strip | `@auction/marketing-ui` `MarketingInfoStrip` | — | — | 2 (editorial blocks, exhibition header) | Exhibition date/venue/hours row |
| Hero | `@auction/marketing-ui` `MarketingHero` | — | 1 | 1 (home, editorial `home_hero` placement) | Art falls back to a text hero when the placement has no image |
| Video poster | `@auction/marketing-ui` `MarketingVideoPoster` | — | — | 2 (editorial `video` block, story film) | 16:9 poster linking out in a new tab; no third-party iframe |
| Alphabet filter | `@auction/marketing-ui` `MarketingAlphabetFilter` | — | — | 1 (artists A–Z) | Links (`?letter=x`) with `aria-current`, not buttons, so filters are crawlable and shareable |
| Horizontal rail | `@auction/marketing-ui` `MarketingHorizontalRail` | 1 | 1 | 1 (editorial artwork rails, `arrows-progress` controls) | |
| Mobile nav drawer | `@auction/marketing-ui` `MarketingMobileNavDrawer` | 1 | 1 | 1 (header below `lg`, with auth section) | Art puts flat links in the top slot and passes no sections; the drawer then omits its "Mobile primary" landmark |
| LAX wordmark | `@auction/marketing-ui` `LaxLogo` | 2 (via `ShopLaxLogo`) | 2 | 2 | `@auction/branding` ships canonical SVG path |
| Account menu (guest + signed-in) | `@auction/marketing-ui` `MarketingGuestAccountMenu` / `MarketingAuthenticatedAccountMenu` | 2 (Shop-specific wrappers) | — | 1 | Art passes `ArtAuthLink` for OIDC entry |
| Heart / save toggle | `@auction/marketing-ui` `MarketingHeartToggle` | — | — | 1 (artwork favorite) | Bid keeps local `watchlist-heart*` and `artist-watch-heart`; Shop has `artwork-notify-me-button` (different intent) |
| Bottom tab bar | `@auction/marketing-ui` `MarketingBottomTabBar` | — | — | 1 (mobile nav) | Bid keeps local `layout/bottom-tab-bar` |
| Card media / `MediaImage` | `@auction/marketing-ui` | 5 / 8 | — / 63 | 2 / 6 | |
| Filter sheet / sidebar / active chips | `@auction/marketing-ui` | 1 / 1 / 1 | 7 / 4 / 8 | 1 / 1 / 1 | |
| Section header / status state | `@auction/marketing-ui` | 1 / 1 | 11 / 1 | 1 / 2 | |
| Detail shell | `@auction/marketing-ui` `MarketingDetailShell` | 11 | 8 | — | Renders its own `<main id="main-content">`; Art avoids it to keep a single landmark inside the root layout |
| Page gutter | `@auction/branding` `MARKETING_PAGE_SHELL` | 2 | 25 | 11 | |
| Product switcher | `@auction/lax-ecosystem` via product wrapper | 2 | 2 | 2 | |
| Money / date presenters | `@auction/shop-portal/vm` (`formatGbpPence`, `formatShopDate`) | 12 / 5 | — | 2 / 1 | Art's former copies of Shop presenters were deleted |
| Grid / list view | `@auction/marketing-ui` `MarketingCatalogViewSwitcher` + `MarketingCatalogView` (`useCatalogViewNavigation`) | 1 (artworks) | local `CatalogViewSwitcher` (same `ViewSwitcher`) | 1 (artworks) | Bid's contract: `?view=` is the source of truth, `lax_view_<routeKey>` cookie remembers it, default view drops the param. Art/Shop pass `clearParams={[]}` so cursor pagination survives a switch |
| List row | `@auction/marketing-ui` `MarketingCatalogListRow` | 1 | lot list rows (local) | 1 | Thumbnail, title, artist, meta, price and trailing actions in one row |
| Toolbar row | `@auction/marketing-ui` `MarketingListToolbar` / `MarketingToolbarRow` | 1 | 10 | 1 | With Filters + sort + view switcher, pass `stackTrailingOnMobile` (Bid's pattern) so the switcher drops to its own row below `lg` instead of overflowing at 375px |
| Category tile | `@auction/marketing-ui` `MarketingCategoryTile` | 1 | — | 1 (artworks "Browse by medium") | Tiles are links with `aria-current` on the active filter, laid out in a horizontal rail |
| Share | `@auction/marketing-ui` `MarketingShareButton` | — | — | 1 (artwork detail) | Native share sheet when available, otherwise copies the absolute URL and announces it; cancel is silent |
| In-page tabs | `@auction/marketing-ui` `MarketingUnderlineTabsPanel` | — | route tabs use local `MarketingUnderlineTabs` (same underline) | 1 (artwork about / exhibition history) | A single panel renders as a titled region with no tablist. Tabs wrap rather than scroll, so no unfocusable scroll region exists before hydration |
| Detail accordion | `@auction/marketing-ui` `MarketingDetailAccordion` | — | — | 1 (details, medium & dimensions, provenance) | First item open by default; empty when given no items |
| Footer | `@auction/marketing-ui` `MarketingFooter` | 1 | 1 | 1 | No tagline. Column order: site nav, Account, LAX products, Legal, Connect. Columns accept `note` for a non-link line (e.g. "Sign-in status unavailable") |

## Token layers (web)

1. **Brand primitives** — `--color-brand-*` (obsidian, midnight, light gray, light cream)
2. **Semantic aliases** — `--color-ink`, `--color-paper`, `--color-link`, `--color-cta-*`
3. **UI / shadcn bridge** — `--color-foreground`, `--color-primary`, `--color-muted`, sidebar tokens

Email hex mirrors live in [`packages/branding/src/tokens.ts`](../packages/branding/src/tokens.ts).

## LAX colour rule: one palette, one accent per product

Set by the product owner on 2026-10-21. It applies to every LAX product: Bid, Shop, Art, Account, and any later product.

- **One shared palette.**
  - Every product uses the same neutrals: obsidian, ink, light gray, light cream, and the surface and neutral scales.
  - Every product uses the same status colours: success, info, warning, danger, live red.
  - The shared typefaces are Montserrat (primary) and Outfit (secondary). No product adds another face, even when a Figma file uses one.
- **One unique accent per product.** Each product owns exactly one accent colour, and no other product uses it.
  - The accent marks the product's identity: the product word in its wordmark, and optionally its own highlights.
  - The LAX wordmark is otherwise identical across products. For example, the Bid logo is the shared black and light-gray LAX mark with "BID" in navy (`packages/auth/src/hosted-auth/assets/lax-bid-logo.svg`).
- **Assigned accents:**

  | Product | Accent | Status |
  | --- | --- | --- |
  | LAX Bid | Midnight navy `--brand-midnight` #091F5B | Assigned |
  | LAX Shop | — | To be chosen |
  | lax.art | — | To be chosen |
  | LAX Account | — | To be chosen |

  Until a product's accent is chosen, that product uses the shared neutrals only. Primary actions, links and focus rings use obsidian or ink, never another product's accent.
- **Shared controls stay neutral.**
  - `Button` default, links, focus rings, tabs, toggles and form controls use shared neutral tokens, so they look the same in every product.
  - A product accent may tint only product-identity moments: the wordmark, an optional active-nav underline, and editorial highlights. It never tints a control's meaning, and status colours never change per product.
- **Where accents live.**
  - Accents are declared once in `@auction/branding`, as a per-product accent token keyed by product id.
  - Each app's `base.css` maps its own accent to a single semantic token, `--color-product-accent`.
  - Components never reference `--brand-midnight` or another product's accent directly.

Current deviations, still to migrate:
- `apps/shop/src/app/base.css` maps midnight to `--color-secondary`, `--color-link`, `--color-ring` and the container tints.
- `apps/account/src/app/globals.css` maps midnight to `--color-link` and `--color-ring`.

Where a non-Bid Figma file draws navy (e.g. CTAs in the lax.art rebuild), build it with the shared neutral CTA. `scripts/ci/verify-art-theme.test.mjs` fails if Bid's accent appears in `apps/art/src`.

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
| `pnpm lint:ui-guardrails` | No raw `<button>`, native form controls, direct `@radix-ui/*`, `window.confirm` in `apps/web`; for `apps/art/src` additionally no raw `<input>`, `lucide-react`, `vaul` or "View All" labels |
| `pnpm ci:shop-architecture` (`verify-art-theme`) | Art semantic-token contract: no palette utilities in `.tsx`, no raw hex outside `base.css` |
| `pnpm lint:lib-admin-boundaries` | Blocks `lib/admin` → `@/components` imports (also in `ci:verify`) |
| `apps/web` lint | Native form controls, Query usage allowlist, session ownership |
| `packages/branding` tests | Token drift vs `globals.css`; event `brand-tokens.css` alignment |
| Playwright axe | Marketing smoke + admin a11y (WCAG 2a/2aa); Art `@a11y` axe on `#main-content` + viewport overflow audit (375/1024/1440) in `.github/workflows/art-e2e-pr.yml` |

## Motion (`@auction/marketing-ui`)

Shared scroll feel and reveal primitives for **Art**, **Shop**, and **Bid marketing** routes. Saleroom, live bidding, account, admin, and Bid `(task)` routes stay on native scrolling.

| Piece | Use when |
|-------|----------|
| **`SmoothScroll`** | Mount once per app root (Art/Shop `layout.tsx`, Bid `app/(marketing)/layout.tsx`). Respects `prefers-reduced-motion` (native scroll). |
| **`MarketingReveal`** | Below-the-fold **sections** (home rails, hub copy, editorial blocks). Pass `index` for stagger. Default variant: **`rise`**. |
| **`MarketingSectionReveal`** | Prose / CTA bands on marketing hubs (sell, about, private sale). |
| **`MarketingCardReveal`** | Grid or carousel **cards** (`index={i}`). |
| **`CountUpInView`** | Numeric stats that should count up when scrolled into view (composes `@auction/ui` `CountUp`). |
| **`RevealOnMount` / `wipe` / `zoom`** | Bid hero accents only — not for catalogue grids. |

**Do not wrap above-the-fold heroes** (LCP). In-view reveals that are already on screen at hydration keep their server-rendered paint and do not animate, so only content scrolled into view rises. Apps with an in-app motion override pass it as `<SmoothScroll reducedMotion={…}>` (Bid does). Reveal CSS lives in [`packages/marketing-ui/src/marketing-ui.css`](../packages/marketing-ui/src/marketing-ui.css); presets in [`packages/marketing-ui/src/motion/presets.ts`](../packages/marketing-ui/src/motion/presets.ts).

**Inner scroll areas** (dialogs, sheets, horizontal rails, mega-menu panels) must expose `data-lenis-prevent` so Lenis does not smooth-scroll nested overflow. See `packages/ui` sheet/dialog viewports and `marketing-horizontal-rail.tsx`.

**Programmatic scroll:** `useSmoothScroll().scrollTo(target, { offset })` — offset should clear the sticky marketing header (`--marketing-header-height`).

## Adding components

1. Prefer an existing primitive from `@auction/ui/components/*`.
2. App-specific wrappers belong in `apps/web/src/components/ui/` (RHF, filters, marketing shells).
3. New shadcn components: follow [`packages/ui/README.md`](../packages/ui/README.md) (`pnpm dlx shadcn@latest add …` from `packages/ui`).
4. Do not hardcode legacy hex or fonts in component source — use semantic Tailwind tokens (`text-on-surface`, `bg-surface-container-low`, etc.).

## Client data fetching (related)

Server data default is RSC + `*.server.ts`. TanStack Query is reserved for realtime and the invitations/disputes reference lists. See `pnpm --filter @auction/web check:query-usage`.
