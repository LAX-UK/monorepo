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
| **LAX system tokens** | [`packages/branding/public/lax-system.css`](../packages/branding/public/lax-system.css) — the one token layer of the app interfaces, read by the staff kit and Bid's client workspace: neutrals, the status palette, the control edge, focus ring, disabled style, radius roles (4 badges, 6 controls, 8 menus, 12 cards and dialogs), control heights (32/36/44), type and line heights on the 4px grid, shadows, paper, and the `data-lax-density="staff"` / `"client"` layers. Scales and roles in [`lax-system.ts`](../packages/branding/src/lax-system.ts) |
| **LAX system primitives** | [`packages/ui/src/lax`](../packages/ui/src/lax) (`@auction/ui/lax`, with `@auction/ui/lax-theme.css`) — the elements the staff tools and the client workspace share, each reading the density its shell sets: Button, StatusBadge (Bid-wide), Menu, Tabs and Count, TextInput and Field, Switch (with the locked state), Notice, Toaster, MetricCell, Dialog (a bottom sheet on phones), the list toolbar (search, Filter and its sheet, Sort, chips, Showing n of m), the export sheet, preset cards, toggle rows, the empty state and the search palette. `@auction/staff-ui` re-exports them under its staff names. Every element in every state: `/admin/kit` in Bid admin, and the client density alone at `/dev/kit` outside production |
| **Shop storefront** | [`apps/shop`](../apps/shop) — Figma `1:651` layout; see [Shop storefront architecture](./ui/shop-storefront-architecture.md) |
| **Identity hosted login** | [`packages/auth/src/hosted-auth/styles.ts`](../packages/auth/src/hosted-auth/styles.ts) — Bid-equivalent floating-label underline fields, 528px column, 44px controls; served at `auth…/hosted-auth.css` |
| **Ecosystem contracts** | [`packages/lax-ecosystem`](../packages/lax-ecosystem) — product directory, account chrome VMs, LAX Account v1 DTOs; see [architecture/11](./architecture/11-lax-ecosystem-boundary.md) |

## LAX ecosystem UX

Bid and Shop remain **purpose-built products** with recognizable shared DNA:

| Element | Shared contract | Product-owned |
|---------|-----------------|---------------|
| Product naming | “LAX Bid”, “LAX Shop” in switcher and footers | Primary nav, mega-menu, commerce rails |
| Account entry | Guest vs signed-in header; `/account` on Shop; Bid account chip | Account page layout beyond identity summary |
| LAX top bar | `LaxFamilyBar` (`@auction/marketing-ui`) fed by `buildLaxFamilyLinks` (`@auction/lax-ecosystem`): LAX Bid · lax.art · LAX Shop, then LAX Account | The optional right-side message or actions |
| Focus / targets | `FOCUS_RING` from `@auction/branding`; 44×44 minimum interactive targets | BEM vs Tailwind composition |
| Loading / errors | Discriminated account states (`unavailable` ≠ guest) | Product-specific error copy |

Wayfinding must use configuration (`LAX_BID_PUBLIC_URL`, `LAX_SHOP_STOREFRONT_URL`), not hardcoded production hosts in components.

### One family: shared primary button, top bar and paper

- **Primary button.** `Button` `variant="primary"` (and its alias `cta`) is the one primary button of every client-facing product: a flat fill in the product's `--color-cta-bg` with `--color-cta-on` text (ink on Bid, Shop and lax.art; teal on LAX Account). Hover and pressed step the fill through `--color-cta-bg-hover` / `--color-cta-bg-pressed`, which a product may set (Account darkens its teal); the defaults mix the fill toward its label colour. The focus ring is the product's `--color-ring`. No gradients or shadows. Staff tools keep the staff kit's neutral primary.
- **LAX top bar.** Every client-facing product (Bid site and client area, Shop, lax.art, LAX Account) renders `LaxFamilyBar` as the first row of its header: the products in that order, the current one semibold in full ink with `aria-current="true"`, then LAX Account after a divider. The right side takes an optional `message` (Shop's collection and delivery note) or the product's existing utility `actions`. It is 36px tall, 12px sentence-case names, hidden below `lg`; there, each product's menu lists the same siblings with `LaxFamilyMenuLinks` (the shared mobile drawer takes `familyLinks`). Never on staff shells.
- **Paper.** `--brand-paper` / `--brand-paper-on-dark` (`BRAND_SURFACES`) are the soft warm paper (`#f6f4ee`) and its dark equivalent (`#1a1b1a`); lax.art and Shop map them to `--color-surface-paper`. lax.art's feature bands and Shop's `--color-paper` (artwork mats, gallery-wall bands) read from it.

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
- **Loading skeletons only on list routes that never rewrite their own query string.**
  - Route skeletons live in `(home)`/`(index)` route groups.
  - Slug routes (`[slug]`) render without a `loading.tsx` above them, so a missing record answers a real 404 (not a 200 soft 404) and an outage a 500. `apps/art/src/lib/seo/page-status.test.ts` enforces this.
  - Routes that navigate by query string (the artwork catalogues, artists A–Z, exhibition tabs, search) have no `loading.tsx` either. With the React build in Next 15.5, a query-only navigation inside an already visible loading boundary can lose its retry and never commit in production. `apps/art/src/lib/routing/query-navigation-routes.test.ts` enforces this.

### Primitive audit (Shop · Bid · Art)

Counts are files importing the primitive (excluding tests). Rows from the original lax.art pass are unchanged unless noted; rows added for the Figma parity work were counted on `main` after it. Rows marked (#551) or (#552) are built by those pull requests and were counted on their branches. "—" means unused.

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
| Side sheet (576px desktop, bottom sheet mobile) | `@auction/marketing-ui` `MarketingSideSheet` | — | — | 3 (two enquiry sheets, artwork "More options" sheet) | `titleCase="sentence"` option; the default keeps the caps style. Shop/Bid candidates to adopt |
| Pull quote | `@auction/marketing-ui` `MarketingPullQuote` | — | 1 (press) | 1 (editorial blocks) | Bid keeps local `pull-quote.tsx` until migrated |
| Info strip | `@auction/marketing-ui` `MarketingInfoStrip` | — | — | 1 (editorial blocks) | Exhibition date/venue/hours row; exhibition detail now uses `MarketingFactColumns` |
| Hero | `@auction/marketing-ui` `MarketingHero` | — | 1 | 1 (home, editorial `home_hero` placement) | Art falls back to a text hero when the placement has no image |
| Video poster | `@auction/marketing-ui` `MarketingVideoPoster` | — | — | 2 (editorial `video` block, story film) | 16:9 poster linking out in a new tab; no third-party iframe |
| Alphabet filter | `@auction/marketing-ui` `MarketingAlphabetFilter` | — | — | 1 (artists A–Z) | Links (`?letter=x`) with `aria-current`, not buttons, so filters are crawlable and shareable |
| Horizontal rail | `@auction/marketing-ui` `MarketingHorizontalRail` | 1 | 1 | 1 (editorial artwork rails, `arrows-progress` controls) | |
| Mobile nav drawer | `@auction/marketing-ui` `MarketingMobileNavDrawer` | 1 | 1 | 1 (header below `lg`, with auth section) | Art puts flat links in the top slot and passes no sections; the drawer then omits its "Mobile primary" landmark |
| LAX wordmark | `@auction/marketing-ui` `LaxLogo` | 2 (via `ShopLaxLogo`) | 2 | 2 | `@auction/branding` ships canonical SVG path |
| Account menu (guest + signed-in) | `@auction/marketing-ui` `MarketingGuestAccountMenu` / `MarketingAuthenticatedAccountMenu` | 2 (Shop-specific wrappers) | — | 1 | Art passes `ArtAuthLink` for OIDC entry |
| Heart / save toggle | `@auction/marketing-ui` `MarketingHeartToggle` | — | — | 1 (artwork favorite) | `appearance` (`circle` default, `bare`, `onMedia`) and `size` (`md`, `sm`); saved fill from `--color-favorite`. Bid keeps local `watchlist-heart*` and `artist-watch-heart`; Shop has `artwork-notify-me-button` (different intent) |
| Bottom tab bar | `@auction/marketing-ui` `MarketingBottomTabBar` | — | — | 1 (mobile nav) | `variant="floating"` (inset pill) is Art's; default unchanged. Bid keeps local `layout/bottom-tab-bar` |
| Card media / `MediaImage` | `@auction/marketing-ui` | 5 / 8 | — / 63 | 2 / 6 | |
| Filter sheet / sidebar / active chips | `@auction/marketing-ui` | 1 / 1 / 1 | 7 / 4 / 8 | 1 / 1 / 1 | |
| Section header / status state | `@auction/marketing-ui` | 1 / 1 | 11 / 1 | 1 / 2 | |
| Detail shell | `@auction/marketing-ui` `MarketingDetailShell` | 11 | 8 | — | Renders its own `<main id="main-content">`; Art avoids it to keep a single landmark inside the root layout |
| Page gutter | `@auction/branding` `MARKETING_PAGE_SHELL` | 2 | 25 | 11 | |
| LAX top bar | `@auction/marketing-ui` `LaxFamilyBar` / `LaxFamilyMenuLinks` + `@auction/lax-ecosystem` `buildLaxFamilyLinks` | 1 | 2 (site header, client shell) | 1 | LAX Account uses it too; the per-product switchers and `MarketingUtilityBar` are removed |
| Money / date presenters | `@auction/shop-portal/vm` (`formatGbpPence`, `formatShopDate`) | 12 / 5 | — | 2 / 1 | Art's former copies of Shop presenters were deleted |
| Grid / list view | `@auction/marketing-ui` `MarketingCatalogViewSwitcher` + `MarketingCatalogView` (`useCatalogViewNavigation`) | 1 (artworks) | local `CatalogViewSwitcher` (same `ViewSwitcher`) | 1 (artworks) | Bid's contract: `?view=` is the source of truth, `lax_view_<routeKey>` cookie remembers it, default view drops the param. Art/Shop pass `clearParams={[]}` so cursor pagination survives a switch |
| List row | `@auction/marketing-ui` `MarketingCatalogListRow` | 1 | lot list rows (local) | 1 | Thumbnail, title, artist, meta, price and trailing actions in one row. `size="lg"` (large landscape media) and an `aside` slot (price, heart, Enquire) are Art's |
| Toolbar row | `@auction/marketing-ui` `MarketingListToolbar` / `MarketingToolbarRow` | 1 | 10 | 1 | With Filters + sort + view switcher, pass `stackTrailingOnMobile` (Bid's pattern) so the switcher drops to its own row below `lg` instead of overflowing at 375px |
| Category tile | `@auction/marketing-ui` `MarketingCategoryTile` | 1 | — | 1 (artworks "Browse by medium") | Tiles are links with `aria-current` on the active filter, laid out in a horizontal rail |
| Share | `@auction/marketing-ui` `MarketingShareButton` | — | — | 1 (artwork detail) | Native share sheet when available, otherwise copies the absolute URL and announces it; cancel is silent |
| In-page tabs | `@auction/marketing-ui` `MarketingUnderlineTabsPanel` | — | route tabs use local `MarketingUnderlineTabs` (same underline) | 1 (artwork about / exhibition history) | A single panel renders as a titled region with no tablist. Tabs wrap rather than scroll, so no unfocusable scroll region exists before hydration |
| Detail accordion | `@auction/marketing-ui` `MarketingDetailAccordion` | — | — | 1 (details, medium & dimensions, provenance) | First item open by default; empty when given no items |
| Footer | `@auction/marketing-ui` `MarketingFooter` | 1 | 1 | 1 | No tagline. Column order: site nav, Account, LAX products, Legal, Connect. Columns accept `note` for a non-link line (e.g. "Sign-in status unavailable") |
| Page title | `@auction/marketing-ui` `MarketingPageTitle` | — | — | 9 (collector hub, visit, contact, exhibition detail, stories, artist hero, account, editorial pages) | `plain` and `media` variants, `density="compact"` for short pages; `actions` slot for the artist Follow. `/artists` and `/artworks` still use the local left-aligned `ArtPageHeader` |
| Sub-navigation | `@auction/marketing-ui` `MarketingSubNav` | — | — | 5 (exhibitions index and detail, stories reading bar, artist profile, account and favourites tabs) | Link and anchor modes, sticky identity bar, reading progress. Bid keeps local `marketing-underline-tabs`; Art's `SectionTabs` use on exhibitions is gone |
| Split feature | `@auction/marketing-ui` `MarketingSplitFeature` | — | — | 2 (+1 with #552) | Home promos, artist sell prompt; `h1` option (#552) |
| Gallery team band | `@auction/marketing-ui` `MarketingGalleryTeamBand` | — | 2 (home, edition page) | 8 (home, contact, visit, venue, exhibition, Collector Hub, its service pages, how to buy) | Every "talk to us" close. Photograph, invitation, the host's actions, an optional reply promise, and details (phone, email, address, hours) that link when given an `href`. Art: one primary "Begin a private enquiry"; opening hours only when the shared gallery contact has them |
| Feature grid | `@auction/marketing-ui` `MarketingFeatureGrid` | — | — | 1 | `lead-plus-row` and `lead-plus-stack` layouts for home What's on and stories |
| Venue card | `@auction/marketing-ui` `MarketingVenueCard` | — | — | 1 | Home galleries and `/visit` |
| Editorial card | `@auction/marketing-ui` `MarketingEditorialCard` | — | — | 1 (`ArtEditorialCard`) | Aspects `landscape` (default), `portrait`, `wide`; kicker, detail lines, trailing slot |
| Editorial list row | `@auction/marketing-ui` `MarketingEditorialListRow` | — | — | 1 | Kicker, meta line, `linkAs`, inverse tone: exhibition press, Art hub press band (#552) |
| Reveal carousel | `@auction/marketing-ui` `MarketingRevealCarousel` | — | — | 1 | Split slide with dots; never autoplays. Exhibitions hero |
| Fact columns | `@auction/marketing-ui` `MarketingFactColumns` | — | — | 1 | Icon, label and links; centred columns, or `layout="list"` rows (#551). The local `ArtVenueFacts` is removed with #551 |
| Filter dropdown / facet group | `@auction/marketing-ui` `MarketingFilterDropdown` / `MarketingFilterFacetGroup` | — | — | 1 / 1 | Draft state with Cancel / Apply on desktop, Reset all / Show results on mobile. Replaced Art's single-select rail options |
| Header search | `@auction/marketing-ui` `MarketingHeaderSearch` | — | — | 1 | Inline field with recent searches (local storage) and suggestions |
| Header mega nav | `@auction/marketing-ui` `MarketingHeaderMegaNav` | 1 | 1 | 1 | Extended with `columns`, `linkHref` and item `media`; defaults unchanged |
| Spec list | `@auction/marketing-ui` `MarketingSpecList` | — | — | 1 | Artwork spec table |
| Read more | `@auction/marketing-ui` `MarketingReadMore` | — | — | 2 | Clamped text with toggle: artist biography and exhibition artists |
| Artist summary | `@auction/marketing-ui` `MarketingArtistSummary` | — | — | 1 | Avatar, name, Follow, clamped bio on artwork detail |
| Sticky action bar | `@auction/marketing-ui` `MarketingStickyActionBar` | — | — | 1 | Mobile Follow and Enquire bar; candidate to generalise Bid's `StickyBidBar` |
| Follow row | `@auction/marketing-ui` `MarketingFollowRow` | — | — | 1 | Followed artists |
| Enquiry list item | `@auction/marketing-ui` `MarketingEnquiryListItem` | — | — | 1 | Default, artwork and compact variants |
| Success state | `@auction/marketing-ui` `MarketingSuccessState` | — | — | 2 | Animated check, static under reduced motion (enquiry sheets) |
| Status state motif | `@auction/marketing-ui` `MarketingStatusState` | 1 | 1 | 2 | New `search-remove` motif for empty search |
| Feature card | `@auction/marketing-ui` `MarketingFeatureCard` | — | — | 1 (#551) | `split`, `vertical`, `text` variants: collector hub, Art hub |
| Step card | `@auction/marketing-ui` `MarketingStepCard` | — | — | 1 (#551) | How to buy |
| Audio player | `@auction/marketing-ui` `MarketingAudioPlayer` | — | — | 3 (#552) | Art hub podcast, stories podcast tab, podcast articles |
| Link list | `@auction/marketing-ui` `MarketingLinkList` | — | — | 1 (#552) | Art hub quick links |
| List row (link) | `@auction/ui` `ListRow` | — | 2 | 1 | `href` / `asChild`; LAX Account uses it in 2 files for settings and edit-account rows |
| Alert (inverse) | `@auction/ui` `Alert` | 1 | 81 | 6 | `inverse` variant for the account "almost ready" banner; defaults unchanged |
| Slider thumb label | `@auction/ui` `Slider` | — | — | 1 (via audio player, #552) | Optional `thumbLabel` for the accessible name of the scrubber |

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
  - The LAX mark is otherwise identical across products. The Bid logo is the shared black and light-gray LAX mark with ".BID" in navy (`packages/auth/src/hosted-auth/assets/lax-bid-logo.svg`).
  - Every product's lockup is the same mark with a dot and a descriptor word at its lower right, set on Bid's baseline and left edge. Lockups live in `packages/branding/src/lockup` and ship as vector files from `@auction/branding/lockups/` (light and dark each). See [Lockups](#lax-lockups).
- **Assigned accents:**

  | Product | Accent | Status |
  | --- | --- | --- |
  | LAX Bid | Midnight navy `--brand-midnight` #091F5B; `--brand-midnight-on-dark` #A5B7E9 for its name as text on dark surfaces | Assigned |
  | LAX Shop | Aubergine `#5a2a5c` on light surfaces, `#d6a8d4` on dark | Assigned 2026-10-26 |
  | lax.art | — | To be chosen |
  | LAX Account | Deep teal `#0f766e` on light surfaces, `#2dd4bf` on dark | Assigned 2026-10-23 |

  Until a product's accent is chosen, that product uses the shared neutrals only. Primary actions, links and focus rings use obsidian or ink, never another product's accent.
  Account's teal is declared as `PRODUCT_ACCENTS.account` and `PRODUCT_ACCENTS_ON_DARK.account`. It appears only on the lockup descriptor, the primary button and the focus ring, never on success states (success stays green) and never as text on `--color-surface-container-high` (4.47:1). Contrast, checked against Account's real tokens: `#0f766e` is 5.47:1 on `#ffffff` and 4.72:1 on `#eeeeee`; `#2dd4bf` is 9.93:1 on the dark page `#121414`, 9.20:1 on the dark surface `#1a1c1c` and 6.64:1 on `#333534`; white on `#0f766e` is 5.47:1 and obsidian on `#2dd4bf` is 11.28:1.
  Shop's aubergine is declared as `PRODUCT_ACCENTS.shop` and `PRODUCT_ACCENTS_ON_DARK.shop`, chosen by the owner from three candidates (aubergine, oxblood, gilt bronze) because no status colour or other product uses violet. Contrast on Shop's tokens: `#5a2a5c` is 10.9:1 on `#ffffff` and 9.4:1 on `#eeeeee`; `#d6a8d4` is 9.2:1 on the dark page `#121414` and 6.7:1 on `#2d2f2e`.
- **Product names take their product's colour.** Wherever a product's interface names another LAX product in text (a sentence, a list row, the product of a work), the name is set in that product's accent: Bid in navy (#091F5B on light, #A5B7E9 on dark, 15.5:1 and 8.6:1 on Account's surfaces), Shop in aubergine (#5A2A5C on light, #D6A8D4 on dark), Account in its teal, and lax.art in ink until its accent is chosen. Buttons, links and the product switcher stay neutral, and a legal business name ("LAX Bid Ltd") is not a product name. In Account this is the `ProductName` component (and `ProductText` for plain copy), backed by `--color-product-<id>` tokens; the hosted sign-in pages do the same in their one-account note. These tokens are the only place Bid's navy may appear outside Bid, and the theme guards allow exactly them.
- **Shared controls stay neutral.**
  - `Button` default, links, focus rings, tabs, toggles and form controls use shared neutral tokens, so they look the same in every product. LAX Account is the one deliberate exception: it maps its CTA button and focus ring to its teal through `--color-product-accent`, by owner decision.
  - A product accent may tint only product-identity moments: the wordmark, an optional active-nav underline, and editorial highlights. It never tints a control's meaning, and status colours never change per product.
- **Where accents live.**
  - Accents are declared once in `@auction/branding`, as a per-product accent token keyed by product id.
  - Each app's `base.css` maps its own accent to a single semantic token, `--color-product-accent`.
  - Components never reference `--brand-midnight` or another product's accent directly.

All products comply with the colour rule; none is waiting to migrate. Each non-Bid app maps `--color-secondary` and the container tints to shared neutrals. Art keeps links and focus rings neutral and declares `--color-product-accent` as its primary neutral until its accent is chosen; Account declares teal. Shop declares aubergine and uses it for the .SHOP tag, the active-nav underline, links, focus rings and selected filter chips; its primary buttons stay ink and its status colours never take it. Because links share the text colour, they stay underlined so colour is never the only cue (WCAG 1.4.1).

Where a non-Bid Figma file draws navy (e.g. CTAs in the lax.art rebuild), build it with the shared neutral CTA. Three guards in `pnpm ci:shop-architecture` fail if Bid's accent (`brand-midnight`, #091F5B or #081F5B) appears in a non-Bid app (the Account guard also fails if Account's teal appears in Bid, Shop or Art, and the Art guard fails if it appears in `apps/art/src`): `scripts/ci/verify-shop-theme.test.mjs` for `apps/shop/src`, `scripts/ci/verify-art-theme.test.mjs` for `apps/art/src`, and `scripts/ci/verify-account-theme.test.mjs` for `apps/account/src`.

### LAX lockups

A lockup is the LAX mark plus a product descriptor. `packages/branding/src/lockup/lockup.ts` is the single definition; the files in `packages/branding/public/lockups/` are generated from it (`pnpm --filter @auction/branding generate:lockups`) and a test fails if they drift.

- **Marks.** The gavel in the A is Bid's auction mark and appears only in the Bid lockup. Every other lockup (and the bare mark) uses the plain LAX: the L, a thin two-stroke A with no crossbar, the X and the grey slash, so no other product reads as an auction product.
- **Geometry.** The L, X, slash and Bid tagline are outlined paths from the Bid master (the plain X without the foot that only meets the gavel handle, with a shorter lower-left leg); on the plain mark the X and slash sit 18 units left of Bid's, as in the shared raster logo, and the descriptor moves with them; the plain A is rebuilt from the Bid A's stroke width, slope, apex and baseline. Every descriptor is a dot then capitals, on Bid's baseline, cap height (46.14 of 287.96) and left edge (the dot at x 624.85). Bid keeps its "Auction Xchange®" tagline; Shop and Art show the mark and descriptor only and use a tight frame. Account's full lockup is built like Bid's: the plain mark, a two-line "Account / Centre®" name on Bid's cap height and baselines (Montserrat semibold outlined by `packages/branding/scripts/outline-account-name.py`, squeezed to 94% because Bid's letters are narrower), and the tag ".ID" (`ACCOUNT_TAG` in `lockup.ts`; ".IDENTITY" was the other candidate and is a one-line switch) in the position of ".BID", on Bid's canvas height so the two render at one size. `account-compact` is the mark and the tag alone, as `bid-compact` is for Bid.
- **Letters.** Bid's `BID` uses its original outlines, because that face is not a font we have. Other words are Montserrat capitals converted to outlines at weight 720 (the weight where the stem of "I" equals BID's 11.24 units) with 4.4 units of tracking, so they need no font at runtime. Regenerate glyphs with `packages/branding/scripts/outline-descriptor-glyphs.py`.
- **Colour.** Descriptor in the product accent, re-tuned for dark surfaces; neutral ink for Art until its accent is chosen. Bid keeps the navy and the light-grey dark variant of its master.
- **In apps.** `LaxLockup` from `@auction/marketing-ui` renders the lockup inline: the mark follows the text colour and the descriptor follows `--color-product-accent`, so one component serves light and dark. Use the static files where CSS variables are unavailable.
- **London Art Exchange.** The `exchange` lockup is the plain mark with the three-line "London / Art Exchange® / Marylebone" tagline, the wordmark in the lax.art header and footer. The tagline is Montserrat outlined by `packages/branding/scripts/outline-tagline.py` (weights 560, 580 and 420, squeezed to 90-94% and placed letter by letter) so that it overlaps the raster wordmark it replaced: ink overlap 0.89 for the mark and 0.84, 0.73 and 0.72 for the three lines (0.82 overall, measured at 2x). Montserrat is the closest face we ship to the geometric sans of the raster, which is why the lower two lines are the loosest match. The tagline is ink, so it follows the text colour with the mark's strokes.
- **LAX Shop.** `shop-exchange` is the London Art Exchange wordmark unchanged, with the family tag ".SHOP" on a fourth line under "Marylebone": the same outlines, weight, tracking and dot as ".BID" and ".ID", scaled by 71.6 / 70.39 (this name's cap height against the family's), with the dot on the text column and the family's 42.04-unit gap below the line above. Shop draws it 50px tall in the desktop header (its smallest lines render near 9px) and 60px in the footer. Phones and tablets use `shop`, the mark and ".SHOP", the same shape as `bid-compact` and `account-compact`.
- **Slash colour.** The slash is a fixed mist grey (`#b9bac0`) in every scheme: 1.9:1 against a white surface and 9.7:1 against a dark one (`#121212`), and 10.8:1 against the dark ink and 1.9:1 against the white ink it sits beside, so it reads as the lighter accent next to black strokes and as the dimmer one next to white strokes. It is decorative, so it carries no contrast requirement of its own.
- **Which file, which context.**
  - *Inline in a page* (`LaxLockup`, and `LaxLogo` for the Shop and Art wordmark): the strokes paint with `currentColor` and the descriptor follows `--color-product-accent`, so the header tone over a hero, the site theme toggle and the OS setting all recolour it with no image filter. Prefer this wherever the lockup sits in the DOM of an app.
  - *`<img>` where the surface colour is known* (emails, social images, press downloads): the `light` or `dark` file. Light is for light surfaces, dark for dark ones. Bid's header swaps this pair with `dark:` classes, which follow its theme toggle.
  - *`<img>` on a surface that follows the operating system* (hosted pages, documents): the `-auto` file, whose `<style>` switches colour with `prefers-color-scheme: dark`. It reacts to the OS only, never to a site's own toggle, and some consumers (email clients, many image proxies) ignore `<style>` in SVG, so do not use it there.
- **Copies.** Apps serve some lockups from their own files (`packages/branding/src/lockup/lockup-copies.ts`); `generate:lockups` writes them and a test fails if one drifts.

## Bid organisation workspace

The signed-in Bid area for organisation members is built to the organisation workspace standard: its rules carry `OW-*` IDs and each one names the check an auditor makes. The standard lives with the design programme documents; this file keeps only what the code leans on.

- **No client dashboard and no Selling mode.** People work from the sidebar and the account menu. There is one account in use at a time, chosen in the account switcher, and the page shows the same thing for the same address whichever account is in use.
- **One nav model.** `apps/web/src/lib/navigation/client-nav-model.ts` decides the sidebar from the account in use and the capability matrix in `packages/domain/src/entity-capabilities.ts`. Pages repeat the capability check and show the access page when a role opens an address that is not theirs; the API is the real gate. The Organisation page's tabs come from one table in `lib/navigation/organisation-tabs.ts`.
- **Account settings live in LAX Account.** Name, email, password, two-step verification, sessions and addresses are managed in LAX Account for every LAX product. Bid keeps bidding limits, alerts, interests and appearance. Set `NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN` at build time; unset, links use `http://localhost:3040` in development and `https://account.lax.bid` in a production build.
- **Journeys.** One browser journey per organisation role (`apps/web/e2e/org-roles-*.spec.ts`, tagged `@roles`) runs in the Web PR browser gates against the seeded Northbank Gallery; `packages/db/src/seed/dev/organisation-journeys-seed.ts` holds the data they need.

## Staff tools (LAX Admin and Bid admin)

Both staff tools use one design system, [`packages/staff-ui`](../packages/staff-ui/README.md): its own token scale (13px interface type, 32/36px controls, 4px grid, light and dark from one declaration), one shell (grouped collapsible nav, ⌘K, product switcher, account menu), and shared tables, side panels, forms, status badges and timelines. The Radix-backed widgets underneath are the `@auction/ui` primitives. Each tool keeps its own pages and permissions and hides nav items and actions its roles cannot use. Buttons, focus and selection stay neutral in both; the product accent marks only the product tile and the active-nav bar (navy for Bid admin, none yet for LAX Admin).

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
