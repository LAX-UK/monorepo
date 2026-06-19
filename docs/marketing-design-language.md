# Marketing design language

This document is the single source of truth for the marketing surface (`apps/web` route group `(marketing)` and shared global chrome). Implementation must conform here before pixel tweaks.

## Principles

| Principle | Meaning |
|------------|---------|
| **Clarity** | One primary action per viewport band; labels and hierarchy obvious at a glance. |
| **Deference** | Art, photography, and prices lead; chrome (toolbars, borders) recedes. |
| **Depth** | Subtle lift on interaction only — no idle drop shadows on cards. |
| **Rhythm** | One container width, one horizontal padding scale, one vertical section scale. |
| **Consistency** | Same view mode = same component tree and tokens everywhere. |

## Brand Identity (v1.0)

Canonical brand primitives live in [`packages/branding/src/brand-identity.ts`](../packages/branding/src/brand-identity.ts) and map to CSS in [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) `@theme`.

### Color palette

| Brand name | Hex | CSS primitive | Semantic aliases |
|------------|-----|---------------|------------------|
| Obsidian Nocturne | `#000000` | `--color-brand-obsidian` | `--color-ink`, `--color-brand-900`, `--color-cta-bg`, `--color-primary` |
| Midnight Blue | `#091F5B` | `--color-brand-midnight` | `--color-link`, `--color-secondary`, `--color-ring` |
| Light Gray | `#B8B9C0` | `--color-brand-light-gray` | `--color-brand-200`, borders, muted chrome |
| Light Cream | `#F2F1DF` | `--color-brand-light-cream` | `--color-paper`, `--color-hero-cream`, `--color-cta-on` |

**Page shell:** `--color-page-bg` and `--color-background` use `#ffffff` — neutral white, not cream. Reserve light cream for hero bands, email paper, and CTA label colour only.

**Functional accents** (auction UX, not brand primary): `--color-accent-gold`, `--color-lot-orange`, `--color-live-red`. Use `--color-accent-buying` for bid/buy flows — never `--color-primary`.

**Dark mode:** Brand doc is light-only. Dark tokens in `html.dark` invert primary CTAs (cream fill on obsidian text) and lighten midnight for links via `color-mix`.

### Typography

| Role | Typeface | CSS token |
|------|----------|-----------|
| Primary (headlines, body, labels) | Montserrat | `--font-headline`, `--font-body`, `--font-label` |
| Secondary (footer links, supporting UI) | Outfit | `--font-supporting`, `--font-footer-links` |

Load fonts in `apps/web/src/app/layout.tsx` via `next/font/google`. Components MUST use semantic `font-*` utilities — never hardcode font family strings.

**Drift guardrail:** `packages/branding/tests/token-drift.test.ts` fails CI if legacy hex (`#775a19`, `#050505`, `#f1f1f3`) or font hardcodes (`DM_Sans`, `Poppins`) reappear in `apps/web/src`.

**Email:** Transactional email uses `COLORS` + `FONT_STACK_*` from `@auction/branding` (Montserrat/Outfit with system fallbacks). Paper background uses light cream; web page shell uses white.

**Event app:** `apps/event/public/brand-tokens.css` mirrors the same primitives for invitation/RSVP surfaces.

### Token layers

1. **Brand primitives** — immutable hex from Brand Identity v1.0
2. **Semantic** — `ink`, `paper`, `link`, `cta-*` referencing primitives
3. **UI / functional** — shadcn `primary`/`secondary`, status colors, auction accents

## Tokens (reference)

- **Containers:** `--container-max` (1440px), `--container-inner` (1376px). No `max-w-[1920px]` in marketing toolbars.
- **Vertical rhythm:** `--section-spacing`, `--section-spacing-tight`, `--section-spacing-loose`, `--section-pt`, `--header-height`.
- **Display type:** `--text-display-lg`, `--text-display-md`, `--text-display-sm`, `--text-title-section`.
- **Micro type (labels / chips / eyebrows):** `--text-label-1`, `--text-label-2`, `--text-label-3` (maps to Tailwind utilities in `globals.css`).
- **Focus:** `FOCUS_RING` = `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring` (midnight brand; from `apps/web/src/lib/marketing/chrome.ts`).
- **Motion:** `--motion-duration-md`, `--motion-duration-sm`; always pair with `motion-reduce:transition-none` where transitions exist.

## Aspect ratio matrix (locked)

| Variant | Canvas / thumb | Image fit |
|---------|------------------|-----------|
| **Lot editorial** (bold & calm) | `aspect-video` (16/9) | `object-contain` on neutral surface (pillarbox) |
| **Sale editorial** | 16/9 | `object-cover` |
| **Artist editorial** | 16/9 | `object-cover` |
| **Lot grid** | 4/5 | `object-cover` |
| **Sale grid** | 16/10 | `object-cover` |
| **Artist grid** | 4/5 | `object-cover` |
| **Lot list** | 1/1 thumb `size-24` | `object-cover` |
| **Sale list** | 16/10 thumb `size-32` wide | `object-cover` |
| **Artist list** | circular `size-12` | `object-cover` |

**Editorial tone:**

- `editorial-bold`: gradient scrim + overlaid headline (curated landing rails).
- `editorial-calm`: image first, caption/title below, no scrim overlay (in-context rails).

## Interaction vocabulary

- **Hover (cards):** image `scale-[1.02]`, card `-translate-y-px`, `ring-1 ring-primary/20`.
- **Focus:** `FOCUS_RING` on all interactive marketing chrome and link-cards.
- **Icon buttons (chrome):** min touch target 44×44.

## Motion (marketing)

Use the wrappers in `apps/web/src/components/marketing/marketing-reveal.tsx` and presets in `apps/web/src/lib/marketing/motion.ts`. Do **not** sprinkle `RevealInView` + `index * N` delay at call sites.

| Surface | Primitive | Variant | Stagger |
|---------|-----------|---------|---------|
| Card grids, carousels, archive rows | `MarketingCardReveal` | `fadeUp` | 50 ms step, 150 ms cap |
| Section copy columns (CTA bands) | `MarketingSectionReveal` | `fadeUp` | 60 ms step, 120 ms cap |
| Hero media (above fold) | `MarketingHeroReveal` / `RevealOnMount fadeUp` | `fadeUp` | optional `delayMs` |
| Hero copy choreography | legacy `.fade-up-d1…d4` inside hero shells only | — | fixed 150–550 ms presets |

- **`wipeZoom` / `wipe`:** not used on marketing surfaces.
- **Card components** (`MarketingLotTile`, `SaleroomLotCard`, etc.) stay presentational — grids wrap them in `MarketingCardReveal`.

## Component catalog (target)

| Primitive | Responsibility |
|-----------|------------------|
| `MarketingPageShell` | Max width, horizontal padding, optional `bg-page-bg` (see `pageBackground` note under Global chrome). |
| `MarketingPageHero` | Slots: `breadcrumb`, `eyebrow`, `title`, `description`, `meta`, `actions`, `media`. |
| `MarketingBreadcrumb` | Visible trail + optional JSON-LD via builders. |
| `MarketingListToolbar` | Sticky glass bar: count, filters, sort, trailing (switcher + copy). Active filter chips render **below** the sticky shell (non-sticky). |
| `MarketingCatalogGrid` | Canonical catalogue grid: sparse columns + `auto-rows-fr` equal row heights. All lot/sale catalog grids use this — do not hand-roll grid stretch classes. |
| `MarketingFilterSidebar` | Accordion / link lists for faceted surfaces. |
| `MarketingPagination` | Numbered prev/next + window (from `@auction/ui` `MarketingPagination`). |
| `MarketingLoadMore` | Saleroom infinite / progress pattern. |
| `MarketingLinkCard` | Hover/focus/lift shell for any card-as-link. |
| `MarketingQueryToast` | Query-param toasts (`welcome`, `auth=required`) with `aria-live="polite"`. |
| `CatalogByView` | Generic grid / list / card view dispatcher for catalog surfaces. |
| `PolicyNotice` | `error` \| `primary` \| `warning` policy alerts (suspended, staff, own lot). |
| `MarketingEmptyState` | Unified empty / error copy + CTA on catalog surfaces. |
| `MarketingSectionHeader` | Section title + subtitle + trailing action (home rails). |
| `MarketingStickyBidBar` | Mobile sticky bid / sale summary (`lg:hidden`); inner gutters match `MARKETING_PAGE_GUTTER_X`. |
| `ChromeIconButton` | 44×44 header icon button with `FOCUS_RING`. |
| `ChromePopoverPanel` | Shared account / notification dropdown shell. |
| `NavLabel` | Uppercase utility / nav label (`NAV_LABEL_CLASSES`, etc.). |
| `KbdHint` | Keyboard shortcut chip (`⌘K` / `Ctrl+K`). |
| `PolicyHubLayout` | Shared chrome for policy/content pages: top tab nav + `md:` sidebar, both driven by `policy-routes.ts`. |
| `LegalPage` / `LegalH2` / `LegalUL` | Reading-column legal/content recipe: `breadcrumb`, `kicker`, `title`, `lastUpdated`, optional `toc` (float at `lg`, `PolicyMobileToc` below). |
| `PolicyMobileToc` | Collapsible "On this page" jump nav for long policy pages (`md:hidden`; the float `TocNav` takes over at `lg`). |
| `policy-routes.ts` | Canonical policy manifest: hub nav, footer "Legal" column, and `/legal` index are all derived from it (`legalPolicyRoutes`, `footerLegalRoutes`, `policyRouteLabel`). |

## Card families

- **`SaleCard`**: composes existing `SaleCardShell`, `SaleCardMedia`, `SaleCardTitle`, `SaleCardMeta`, `SaleCardHeader`, `SaleCardActions`, `SaleLiveBadge` → variants `editorial-bold` \| `editorial-calm` \| `grid` \| `list`.
- **`LotCard`**: single implementation for catalog, archive, search, saleroom, home urgency.
- **`ArtistCard`**: directory + browse views; grid delegates to portrait card.

## Status & live

- **`LotStatusBadge`**: replaces scattered timer/status/STATUS_DISPLAY strings.
- **`SaleStatusBadge`**: replaces `SaleLiveBadge` and duplicate “live” pills.

### AV display exception (`/display/[saleId]`)

The saleroom **projector board** is not a marketing surface. Session status and bid-feed highlights use **high-contrast emerald/amber** on a dark canvas for legibility at distance — not the catalog `StatusBadge` registry (`live-red` / `warning` tokens).

- Map session labels in [`display-session-status-presentation.ts`](apps/web/src/features/saleroom/lib/display-session-status-presentation.ts).
- Do **not** reuse `SaleLifecycleBadge` / `LotStatusBadge` on the AV board unless product explicitly requests parity.
- Catalog and lot-detail surfaces remain on the registry in [`status-presentation.ts`](apps/web/src/lib/presenters/status-presentation.ts).

### Saleroom mobile chrome (hybrid sales)

On hybrid sale pages (`deliveryMode === "hybrid"`), live saleroom session UX splits by viewport:

| Surface | Role |
|---------|------|
| **`SaleMobileSummaryBar`** (mobile, fixed bottom) | Delegates on-block / paused hybrid states to **`SaleroomMobileSummaryBar`**. Primary live action: registry `saleroomOnBlockBadge()` + **Bid now →** to the lot. |
| **`SaleroomLiveLotBanner`** (catalog, `lg+` only) | Desktop cross-lot nudge above the catalog grid. Hidden on mobile catalog (`max-lg:hidden`) when the saleroom session is active — bottom bar owns the CTA. |
| **`SaleroomLiveLotBanner`** (lot detail) | Shown on all viewports when viewing a lot that is **not** on the block — nudges bidders to the current lot. |

**Do not** make the in-catalog on-block banner sticky; it overlaps [`MarketingListToolbar`](apps/web/src/components/marketing/marketing-list-toolbar.tsx) at the same `top` offset.

Shared module [`saleroom-mobile-chrome.ts`](apps/web/src/lib/saleroom/saleroom-mobile-chrome.ts): `SaleroomLotRef`, caption presenters (`saleroomOnBlockCaption`, `saleroomPausedCaption`), `countSaleroomLotProgress`, `resolveSaleroomMobileSummaryBarMode`, `publicSaleroomSessionToRegistryStatus`, `saleroomBidNowCtaClassName`.

Shared UI: `SaleroomSessionCaption`, `SaleroomSessionStatusBadge`, `SaleroomMobileSummaryBar`.

**Sale hero action row** ([`SaleroomHeroActionRow`](apps/web/src/components/sections/saleroom/saleroom-hero-action-row.tsx)): two-band layout on imagery — (1) horizontal button row `Browse → Verify/Register → Follow` at `saleroomHeroActionSizing` (40px), (2) optional KYC caption below via `OverlayToneText`, (3) optional agent registration form in band 3 with `#register-to-bid` anchor. Use `SaleroomRegisterToBid layout="button"` in band 1 and `layout="form"` in band 3; never stack caption above a button inside the button flex.

**Staff viewer participation:** staff accounts lack `bid.place`; derive flags once via [`resolveViewerParticipation`](apps/web/src/lib/presenters/viewer-participation.ts) on marketing pages. Pass `canParticipate={viewer.canParticipateAsBuyer}` to participation surfaces (sticky bars, catalogue bid CTAs, condition-report request). Fold into `registerToBid.show` on sale pages so hero register/verify bands disappear for staff. Keep Follow (sale) and Watchlist (lot) for staff browsing. Lot bid panel gates via `BidGate` → `adminPolicy`.

**Sale participation UX:** no multi-card “How to participate” guide grid — hero CTAs (Browse / Verify / Register / Follow) and the **mobile** sticky bar drive registration and bidding on `lg+`; desktop relies on hero CTAs and in-page chrome (e.g. **`SaleroomLiveLotBanner`** on hybrid catalog). Saleroom sales that offer telephone booking expose a dedicated **Telephone bidding** section ([`SaleTelephoneBiddingSection`](apps/web/src/components/marketing/sale-telephone-bidding-section.tsx); panel owns card chrome) and matching anchor tab via [`buildSaleAnchorTabs`](apps/web/src/lib/marketing/sale-anchor-tab-list.ts). When telephone booking does not apply, tabs collapse to Catalogue + Overview only.

Bottom reserve: `--bottom-chrome-bid` (5rem) via [`bottom-chrome.ts`](apps/web/src/lib/layout/bottom-chrome.ts) for the taller on-block summary bar. On **terminal/closed lots**, the mobile bid bar is hidden and bottom padding collapses to the standard page inset (via [`MarketingBidBarChromeProvider`](apps/web/src/lib/context/marketing-bid-bar-chrome.tsx) + [`shouldShowBidStickyMobileBar`](apps/web/src/components/bid/bid-sticky-mobile-bar.logic.ts)).

### Participation warnings (bid flow)

Anti-snipe extensions and onsite no-web-bidding callouts are **bid-participation UX**, not API lifecycle status. Use [`participation-warning-presentation.ts`](apps/web/src/lib/presenters/participation-warning-presentation.ts) → `ParticipationWarningBadge` / `ParticipationWarningCallout` (`StatusBadge variant="warning"`).

## Forms (marketing-adjacent)

- **Auth:** `FloatingLabelInput` + `AuthSubmitButton` (`variant="cta" size="xl"`).
- **Settings / security / contact:** `UnderlineInput`.

## FAQ policy

- **`FaqFlatList`:** canonical `/faq`, policy pages where SEO and anchor links matter.
- **`FaqAccordion`:** embedded help where vertical space matters. (Not yet implemented — `/faq` and policy pages use `FaqFlatList`; add this primitive only when an embedded-help surface needs it.)

## Global chrome

- **Header `transparentUntilScroll`:** the `SiteHeader` `chromeVariant` (with `transparentPaths`, e.g. the home `/` hero) renders transparent at scroll-top and sets `data-header-tone="on-dark"` for light chrome over imagery; on scroll (or when a mega/menu panel opens) it falls back to the solid `on-light` tone. All other routes use the `solid` variant.
- **`pageBackground` (opt-in):** `bg-page-bg` on `MarketingPageShell` / page `<main>` is opt-in, not the default. Catalog hubs (`/sales`, `/search`, `/archive`, policy hub) standardize on it; editorial/home surfaces may keep their own background. Apply deliberately rather than assuming it is global.
- **Footer:** four-column grid — Auctions, Company, Legal (with the Cookie-preferences link), and Our Services (with social icons). Columns and the footer "Legal" list derive their links from `footer-link-groups.ts` / `policy-routes.ts`; each is a Next `Link` with `FOCUS_RING` and `aria-current` where applicable.

## Responsive breakpoints (locked)

| Band | Width | Marketing behaviour |
|------|-------|---------------------|
| **Mobile** | `< lg` (1024px) | Hamburger nav; filter **sheets** (not sidebars); `MarketingStickyBidBar` / mobile bid chrome; home urgency grid starts at **1 column** (`sm:` → 2-up). |
| **Tablet / small laptop** | `lg`–`2xl` | Full mega nav; filter **sidebar** at `lg+`; catalogue toolbar inline filters at `lg+`; header search is **icon-only** below `2xl`. |
| **Wide desktop** | `2xl+` (1536px) | Full header search bar (`231px`); catalogue toolbars may show inline keyword forms on `/search`. |

**Rules:**

- **Catalogue toolbars** (`MarketingListToolbar`, `HomeSectionToolbar`): inline filters and desktop-only controls use `hidden lg:flex` / `lg:hidden` — aligned with `SplitFilterSheet` (bottom sheet below `lg`, right drawer at `lg+`). Do not split at `md`.
- **Catalogue grids:** third column at `lg:grid-cols-3` unless a page brief documents an exception. Saleroom lot grid (`SaleroomLotsGrid`) uses `lg:grid-cols-3 xl:grid-cols-4` for denser inventory on ultra-wide viewports.
- **Gutters:** always `MARKETING_PAGE_SHELL` / `MARKETING_PAGE_INNER` from `chrome.ts` — no hand-rolled `px-8 md:px-10 lg:px-14`.
- **Page titles:** catalogue hubs use `DisplayHeading size="section"`; policy pages use `DisplayHeading size="lg"`; promo bands use `DisplayHeading size="section"` via `MarketingPromoCta`.
- **Hydration:** prefer CSS visibility (`lg:hidden` / `hidden lg:block`) over JS breakpoint hooks for layout forks; reserve `useIsLg()`-style hooks for controlled overlay routing only.
- **Catalogue hubs:** use `MarketingCatalogHubShell` for `/search`, `/archive`, `/artists`, `/sales` — do not hand-compose `<main>` + `MARKETING_CATALOG_PT` + `MARKETING_PAGE_SHELL`.
- **Detail pages:** use `MarketingDetailShell` for artist profile, sale detail, and lot detail — wayfinding/hero slots plus optional `wrapChildren={false}` for multi-band saleroom layouts.
- **Toolbar rows:** shared count/filter/sort layout lives in `MarketingToolbarRow`; sticky chrome in `MarketingListToolbar`, inset home chrome in `HomeSectionToolbar`. Removable active-filter chips (`CatalogActiveFilterChips`) render **below** the sticky toolbar band — not inside it — so they scroll away with results.
- **Catalogue grids:** use `MarketingCatalogGrid` for equal-height tile rows; cards inside must be `h-full` with caption `mt-auto` (see `LotCardGrid`).
- **Bottom chrome:** fixed mobile bars use `bottom-[var(--sticky-bid-bar-bottom,0px)]` and safe-area padding — not bare `bottom-0`.

### PR checklist (marketing UI)

Before merging marketing UI changes, confirm:

1. Gutters from `chrome.ts` / `MarketingPageShell` / `MarketingCatalogHubShell` — no raw `px-8 md:px-10 lg:px-14`.
2. Catalogue toolbars and `MarketingCatalogToolbarSkeleton` split at **`lg`**, not `md`.
3. Loading routes use the same shell primitive as the loaded page (`MarketingCatalogHubShell` for hubs, `MarketingDetailShell` for detail pages) and `bg-page-bg` matches the loaded background.
4. Layout forks use CSS visibility; no `useIsLg()` for structural render branches.
5. New catalogue hub pages use `MarketingCatalogHubShell`; new detail pages use `MarketingDetailShell`.
6. Page titles use `DisplayHeading` sizes (`section` / `lg`) — no one-off `text-4xl` unless documented.

---

## Per-page layout briefs (ASCII)

### Site header (desktop)

```
┌───────────────────────────────────────────────────────────── max --container-max
│ Utility: About · Contact · FAQ
│ [Logo]     Primary Nav · Primary Nav · Primary Nav  [Search] [Theme] [Acct ▾] [Bell?]
│ ───────────────────────────────────────────────────────────────────────────────
│ (mega panel: full-bleed below first row; click-first on touch, hover on fine pointer)
└─────────────────────────────────────────────────────────────
```

Transparent home hero (`/`): header uses `data-header-tone="on-dark"` at scroll top for light chrome on imagery.

### Site header (mobile drawer)

```
┌────────────── drawer max-w-sm
│ [Logo]                                    [Close]
│ ─ Search (opens command palette) ─
│ Theme toggle
│ ▼ Section
│   Link
│ … utility links …
│ [Create account]  (primary)
│ Sign in           (text link)
└──────────────
```

### Site footer

```
┌─────────────────────────────────────────────────────────────
│ [Logo + tagline]
│ ─────────────────────────────────────────────────────────── (divider)
│ Auctions   Company    Legal              Our Services
│ (links)    (links)    (links +           (links +
│                        Cookie prefs)      social icons)
│ ───────────────────────────────────────────────────────────
│ [Logo]                                   © …  ·  London
└─────────────────────────────────────────────────────────────
```

### Home `/`

```
┌─────────────────────────────────────────────────────────────
│ HERO (full-bleed media + single-line H1 --text-display-lg)
│ [CTA optional]
├─────────────────────────────────────────────────────────────
│ Section: Urgency        [View switch] [View all]
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐   (LotCard grid OR list rows)
│ └────┘ └────┘ └────┘ └────┘
├─────────────────────────────────────────────────────────────
│ Section: Upcoming       MarketingListToolbar (count + switcher)
│ SaleCard grid / SaleCard list rows
├─────────────────────────────────────────────────────────────
│ Section: Editors' picks (LotCard editorial-calm rail)
├─────────────────────────────────────────────────────────────
│ Section: Private sale   (LotCard editorial-bold rail)
├─────────────────────────────────────────────────────────────
│ MarketingPromoCta: Consign
├─────────────────────────────────────────────────────────────
│ Newsletter block
└─────────────────────────────────────────────────────────────
```

### Sales `/sales` (Calendar)

```
┌─────────────────────────────────────────────────────────────
│ MarketingPageHero: title "Calendar", subtitle "Auction calendar"
├─────────────────────────────────────────────────────────────
│ Featured auctions — SaleCard editorial / grid strip
├─────────────────────────────────────────────────────────────
│ SalesPrimaryTabs (horizontal)
├──────────────┬──────────────────────────────────────────────
│ Filter       │ MarketingListToolbar
│ sidebar      │ + SaleCard grid OR list OR calendar grid
│ (desktop)    │ + MarketingPagination / infinite if added
│              │
│ [FAB mobile filters]
└──────────────┴──────────────────────────────────────────────
```

### Sale detail `/sales/[slug]/[id]` (Saleroom)

```
┌─────────────────────────────────────────────────────────────
│ MarketingPageHero (media = cover) + stats + Register CTA
│ SaleroomTabs: Overview | Catalog
├─────────────────────────────────────────────────────────────
│ (Overview tab) OverviewFacts / Venue / Stream / Terms blocks
├─────────────────────────────────────────────────────────────
│ (Catalog tab) Optional LotCard editorial-bold rail (curated)
│ MarketingListToolbar: status chips + CatalogViewSwitcher (grid|list)
│ CatalogLotView
│ MarketingLoadMore (progress + next)
├─────────────────────────────────────────────────────────────
│ Related auctions — horizontal cards
└─────────────────────────────────────────────────────────────
```

### Archive `/archive`

```
┌─────────────────────────────────────────────────────────────
│ MarketingPageHero (Archive eyebrow + H1 + volume chip)
├─────────────────────────────────────────────────────────────
│ ArchiveFilterBar (chips + sort) → may fold into toolbar.filters
│ MarketingListToolbar: count + copy + switcher
│ CatalogLotView (archive VM)
│ MarketingPagination
└─────────────────────────────────────────────────────────────
```

### Search `/search`

```
┌─────────────────────────────────────────────────────────────
│ MarketingPageHero (Search + intro)
│ MarketingListToolbar: SearchFilterForm in filters slot + sort + switcher
│ CatalogLotView
│ MarketingPagination (slim / offset mode)
└─────────────────────────────────────────────────────────────
```

### Artists directory `/artists/*`

```
┌─────────────────────────────────────────────────────────────
│ MarketingPageHero (preset title + description)
│ Alphabet jump + preset chips
├──────────────┬──────────────────────────────────────────────
│ Marketing    │ MarketingListToolbar + CatalogArtistView
│ FilterSidebar│ + MarketingPagination
└──────────────┴──────────────────────────────────────────────
```

### Artist profile `/artist/[slug]/[id]`

```
┌─────────────────────────────────────────────────────────────
│ MarketingBreadcrumb (visible)
│ MarketingPageHero variant media-sticky: portrait + name + actions
│ Bio + read more
│ ArtistWorksFilter (client strip)
│ CatalogLotView
│ MarketingPromoCta submit portfolio
│ ArtistStickyFollow (mobile)
└─────────────────────────────────────────────────────────────
```

### Legal hub `/about`, `/terms`, … `/legal`

```
┌─────────────────────────────────────────────────────────────
│ PolicyHubLayout
│ ┌────────────┐ ┌────────────────────────────────────────────┐
│ │ Side nav   │ │ LegalPage: kicker, H1, optional TOC, prose │
│ │ (current)  │ │                                            │
│ └────────────┘ └────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────
```

### Auth `/login`, `/register`, …

```
┌─────────────────────────────────────────────────────────────
│ AuthLayout (max --auth-column)
│ [Logo]
│ H1
│ description
│ AuthFormShell
│   [banners / query toasts]
│   fields (FloatingLabelInput)
│   AuthSubmitButton
│   divider + SocialSignIn
│   footer links
└─────────────────────────────────────────────────────────────
```

### Onboarding `/onboarding/organisation/step/*`

```
┌─────────────────────────────────────────────────────────────
│ Server: title band
│ OnboardingStepShell
│   H2 step title
│   description
│   [error alert]
│   {children form}
│   [Save later] [Continue]
│ OnboardingJumpNav (client, optional)
└─────────────────────────────────────────────────────────────
```

### Lot PDP `/lot/[slug]/[id]` (follow-up scope)

```
Adopt only: MarketingBreadcrumb, MarketingWatchlistHeart, LotStatusBadge, FOCUS_RING —
full artwork layout refactor is out of scope.
```

---

## Adaptive overlays (image-aware contrast)

Marketing overlays on photos resolve **light** or **dark** chrome from pixels beneath each slot — independent of the site theme toggle. The photo decides; user dark mode does not.

### Architecture

- **`AdaptiveMediaFrame`** wraps a card or hero shell and samples configured slots via canvas (`crossOrigin="anonymous"` on `MediaImage`).
- **`useOverlayTone(slot)`** reads resolved tone for a corner or grouped copy block.
- Primitives consume **`--overlay-fg` / `--overlay-bg` / `--overlay-border`** (and `*-opaque` fallbacks) — never `text-foreground` or `dark:` over imagery.
- Outside a frame, `:root` defaults map overlay vars to existing `--color-*` theme tokens.

### Slot contract

| Slot | Typical consumer |
|------|------------------|
| `topLeft` | Owner badge |
| `topRight` | Watchlist heart, gallery counter |
| `bottomLeft` | Live timer pill, sale status badge |
| `bottomRight` | Gallery expand control |
| `contentBlock` | Hero copy column, editorial-bold title on image |

On the **mobile lot PDP** hero, navigation uses the counter pill (`topRight`), swipe, filmstrip, and Expand only — no dot pile on the hero.

Callers pass **`objectFit: "contain" | "cover"`** explicitly (catalog grid uses contain; sale/editorial tiles use cover). Provider wraps the full card `<article>` when overlays sit outside the image div (e.g. grid watchlist heart).

### Fallbacks

| Condition | Behaviour |
|-----------|-----------|
| Before sample / SSR | Default **light** frosted tone |
| Frosted palettes below WCAG threshold | **Opaque** solid variant via `--overlay-*-opaque` |
| Slot mostly on letterbox (<50% overlap) | Opaque light without sampling |
| Canvas taint / CORS failure | Opaque light |
| `prefers-reduced-transparency` | Opaque vars; no `backdrop-filter` |

v1 accepts a brief default-then-resolve flash (~120ms). Server-side luminance metadata is Phase 2 (out of scope).

---

## Home hero cover uploads

Immersive home heroes use **`object-fit: cover`** inside a viewport-sized frame. Wide desktop masters crop heavily on portrait phones unless art direction is provided.

| Asset | Minimum size | Aspect | Field |
|-------|--------------|--------|-------|
| Desktop hero master | 2560×900 | ≈ 21∶9 | `coverImages[0]` / `coverImageUrl` |
| Mobile hero crop (optional) | 1080×1350 or 1080×1920 | 4∶5 or 9∶16 | `coverImages[1]` / `coverImageMobileUrl` |
| Desktop xl crop (optional) | 2560×900 or 1920×1080 | Wide landscape | `coverImages[2]` / `coverImageDesktopWideUrl` |

**Safe zone:** Keep the subject and branding props (polaroids, lot details, logos) inside the **center 70%** of the frame. Avoid placing critical content within **15%** of the left or right edge on the desktop master.

When no mobile crop is uploaded, the site falls back to the desktop URL with **`object-position: center 35%`** on small viewports. Upload a dedicated portrait crop when edge decorations matter on phone.

On **lg+ viewports** the hero height is capped (`clamp(520px, 60vh, 720px)`) so wide masters show more horizontal content and edge props survive more often.

**Optional focal override:** Per-slide `objectPosition` on the VM (e.g. `center 30%`) can fine-tune crop without a second upload — wire from CMS when available.

**Content audit:** [`docs/runbooks/hero-cover-content-audit.md`](runbooks/hero-cover-content-audit.md)

---

## Implementation checklist

1. Land tokens + lint guards.
2. Land primitives under `apps/web/src/components/marketing/` (and `packages/ui` where shared).
3. Replace consumers page-by-page; delete deprecated files listed in the engineering plan.
4. Run `pnpm test` / `pnpm lint` for touched packages.
