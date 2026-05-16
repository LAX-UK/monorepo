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

## Tokens (reference)

- **Containers:** `--container-max` (1440px), `--container-inner` (1376px). No `max-w-[1920px]` in marketing toolbars.
- **Vertical rhythm:** `--section-spacing`, `--section-spacing-tight`, `--section-spacing-loose`, `--section-pt`, `--header-height`.
- **Display type:** `--text-display-lg`, `--text-display-md`, `--text-display-sm`, `--text-title-section`.
- **Micro type (labels / chips / eyebrows):** `--text-label-1`, `--text-label-2`, `--text-label-3` (maps to Tailwind utilities in `globals.css`).
- **Focus:** `FOCUS_RING` = `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` (shared across chrome and cards).
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

## Component catalog (target)

| Primitive | Responsibility |
|-----------|------------------|
| `MarketingPageShell` | Max width, horizontal padding, optional `bg-page-bg`. |
| `MarketingPageHero` | Slots: `breadcrumb`, `eyebrow`, `title`, `description`, `meta`, `actions`, `media`. |
| `MarketingBreadcrumb` | Visible trail + optional JSON-LD via builders. |
| `MarketingListToolbar` | Sticky glass bar: count, filters, sort, trailing (switcher + copy). |
| `MarketingFilterSidebar` | Accordion / link lists for faceted surfaces. |
| `MarketingPagination` | Numbered prev/next + window (from `@auction/ui` `MarketingPagination`). |
| `MarketingLoadMore` | Saleroom infinite / progress pattern. |
| `MarketingLinkCard` | Hover/focus/lift shell for any card-as-link. |
| `MarketingQueryToast` | Query-param toasts (`welcome`, `auth=required`) with `aria-live="polite"`. |
| `CatalogByView` | Generic grid / list / card view dispatcher for catalog surfaces. |
| `PolicyNotice` | `error` \| `primary` \| `warning` policy alerts (suspended, staff, own lot). |
| `MarketingEmptyState` | Unified empty / error copy + CTA on catalog surfaces. |
| `MarketingSectionHeader` | Section title + subtitle + trailing action (home rails). |
| `MarketingStickyBidBar` | Mobile sticky bid / sale summary (`lg:hidden`). |
| `ChromeIconButton` | 44×44 header icon button with `FOCUS_RING`. |
| `ChromePopoverPanel` | Shared account / notification dropdown shell. |
| `NavLabel` | Uppercase utility / nav label (`NAV_LABEL_CLASSES`, etc.). |
| `KbdHint` | Keyboard shortcut chip (`⌘K` / `Ctrl+K`). |

## Card families

- **`SaleCard`**: composes existing `SaleCardShell`, `SaleCardMedia`, `SaleCardTitle`, `SaleCardMeta`, `SaleCardHeader`, `SaleCardActions`, `SaleLiveBadge` → variants `editorial-bold` \| `editorial-calm` \| `grid` \| `list`.
- **`LotCard`**: single implementation for catalog, archive, search, saleroom, home urgency.
- **`ArtistCard`**: directory + browse views; grid delegates to portrait card.

## Status & live

- **`LotStatusBadge`**: replaces scattered timer/status/STATUS_DISPLAY strings.
- **`SaleStatusBadge`**: replaces `SaleLiveBadge` and duplicate “live” pills.

## Forms (marketing-adjacent)

- **Auth:** `FloatingLabelInput` + `AuthSubmitButton` (`variant="cta" size="xl"`).
- **Settings / security / contact:** `UnderlineInput`.

## FAQ policy

- **`FaqFlatList`:** canonical `/faq`, policy pages where SEO and anchor links matter.
- **`FaqAccordion`:** embedded help where vertical space matters.

## Global chrome

- **`blendWithHero`:** removed — header always uses solid/nav tokens (no transparent-over-hero branch).
- **Footer services:** Next `Link` with `aria-current` where applicable.

---

## Per-page layout briefs (ASCII)

### Site header (desktop)

```
┌───────────────────────────────────────────────────────────── max --container-max
│ [Logo]     Primary Nav · Primary Nav · Primary Nav     [Search————] [Theme] [Acct]
│ ───────────────────────────────────────────────────────────────────────────────
│ (mega panel: full-bleed below first row, hairline top, blur surface)
└─────────────────────────────────────────────────────────────
```

### Site header (mobile drawer)

```
┌────────────── drawer max-w-sm
│ [Logo]                                    [Close]
│ ─ Search input ─
│ ▼ Section
│   Link
│   Link
│ … utility links …
│ [Sign in] [Register]
│ Theme
└──────────────
```

### Site footer

```
┌─────────────────────────────────────────────────────────────
│ [Logo + tagline]
│
│ Col1 (links)    Col2        Col3        [Social icons]
│ ───────────────────────────────────────────────────────────
│ © …                    [Services as Link rows]
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

## Implementation checklist

1. Land tokens + lint guards.
2. Land primitives under `apps/web/src/components/marketing/` (and `packages/ui` where shared).
3. Replace consumers page-by-page; delete deprecated files listed in the engineering plan.
4. Run `pnpm test` / `pnpm lint` for touched packages.
