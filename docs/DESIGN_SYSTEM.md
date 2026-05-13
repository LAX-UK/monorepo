# LAX Auction — design system

This guide defines the visual and interaction rules for future features across web surfaces.
It uses existing implementation as source of truth:

- Marketing home: `apps/web/src/app/(marketing)/page.tsx`
- Artwork detail: `apps/web/src/app/(marketing)/artwork/[id]/page.tsx`
- Sale detail: `apps/web/src/app/(marketing)/sales/[id]/page.tsx`
- Shared tokens: `apps/web/src/app/globals.css`
- Shared primitives: `@auction/ui`
- Dashboard/account references: provided PNGs (left account nav, flat white panels, thin-divider list/table rows)

## Scope and boundaries

- This document is guidance for future feature work.
- It does not change contracts, routes, permissions, or data models.
- Use existing primitives and tokens first; do not fork style systems per page.
- Marketing and dashboard can differ in layout recipe, but they must share typography, spacing rhythm, and token semantics.

## Design principles

1. **Minimal gallery feel**: generous whitespace, restrained chrome, high image prominence.
2. **Hierarchy by typography**: headline and label components carry structure; avoid decorative UI noise.
3. **Thin separators over heavy cards**: prefer subtle borders/dividers before adding shadows or dense containers.
4. **Token-first decisions**: colors, spacing, radius, and surfaces come from `globals.css` semantics.
5. **Reusable composition**: build pages by combining existing section/layout primitives instead of custom one-off wrappers.

## Reference surfaces

### Home (`/`)

- Uses `bg-page-bg` with fixed header offset: `pt-[var(--header-height)]`.
- Section rhythm: hero, upcoming lots, upcoming auctions, artists, newsletter.
- Preferred section framing: `SectionHeader` + action slot + content grid.

### Artwork detail (`/artwork/:id`)

- Split-view detail layout with media + accordion left, summary/actions right.
- Uses 1440 container rhythm and lightweight section framing (`bg-page-bg`, not heavy card stacks).
- Bid/watch/share actions live near summary and remain functionally independent from layout.

### Sale detail (`/sales/:id`)

- Sale hero + toolbar + catalog grid + paginator + overview + related.
- Catalog cards are intentionally “no card chrome” tiles.
- Grid rhythm is explicit and should be reused for similar listing experiences.

### Dashboard/account (image references)

- Left-side account/admin navigation.
- Main content in flat white panels with light borders.
- Table/list screens prioritize thin row dividers, compact badges/status, and clear column alignment.
- Footer/header language remains consistent with public web shell.

## Tokens (`apps/web/src/app/globals.css`)

### Brand ladder

| Token | Use |
|-------|-----|
| `brand-900` … `brand-100` | Text hierarchy, borders, neutrals |
| `accent-brand` | Stat rail, focus rings, bid pulse | Resolves to blue (`--color-accent-blue`) in light, gold (`--color-accent-gold`) in dark |
| `accent-gold` | Literal gold hex | Kept for email/branding parity; prefer `accent-brand` in web UI |
| `lot-orange` | Lot labels, lot identity accents |
| `live-red` | Live indicators |
| `page-bg` | Default marketing canvas |
| `footer-bg`, `divider`, `nav-border`, `nav-text`, `hero-cream` | Shell / hero framing |

### Semantic extensions

| Token | Light role | Notes |
|-------|------------|------|
| `cta-bg` / `cta-on` | Solid CTA contrast | Dark mode inverts for contrast |
| `scrim-hero` / `scrim-hero-mid` | Image overlays | Dark mode deepens scrim |
| `scrim-auth` | Auth radial wash | |
| `input-border` / `input-border-focus` | Underline/floating labels | |
| `hero-foreground` | Text on imagery | |

### Layout vars (`:root`)

- `--header-height` fixed offset (must stay aligned with `SiteHeader`)
- `--container-max`, `--container-inner`, `--auth-column`
- `--section-gutter-*`, `--section-pt`, `--section-pt-tight`
- `--text-label-caps-tracking`

### Dark mode

`html.dark` (via `ThemeInit` and `ThemeToggle`) overrides semantic and marketing tokens.
Do not hardcode light surfaces in shared shells. Prefer semantic classes like `bg-surface`, `bg-page-bg`, and `text-on-surface`.

## Page layout recipes

### 1) Marketing section page (home-like)

- Main wrapper: `id="main-content"` with header offset.
- Use `max-w-[1440px]` container rhythm and consistent responsive paddings.
- Compose page from sections, each with explicit heading and optional action.
- Avoid nesting multiple heavy bordered cards inside large marketing sections.

### 2) Detail page (artwork-like)

- Use split layout for content + transaction/summary.
- Keep media and textual details in separate vertical blocks.
- Keep action row (watch/share/bid) compact and close to summary.
- Related content belongs after primary detail, not between summary and actions.

### 3) Catalog/listing page (sale-like)

- Hero/meta first, list/grid second, supporting panels after.
- For lot tiles, prefer image-led blocks without extra container chrome.
- Keep paging/filter controls spatially close to results.
- Distinguish “catalog browsing” from “data table management” patterns.

### 4) Dashboard/account page (PNG direction)

- Left nav + content panel layout on desktop.
- Single-column flow on mobile with drawer/bottom-nav support.
- Main content panel: flat white, subtle border, minimal shadow.
- Settings/profile blocks should read as sections with concise action affordances.

### 5) Form/settings page

- Prioritize clear section labels and compact vertical spacing.
- Keep actions predictable (`Save`, `Add`, `Edit`) and grouped by section.
- Use existing form primitives and validation messaging patterns.

## Component usage patterns

### Typography (`@auction/ui`)

- `DisplayHeading`: page/section titles.
- `LabelCaps`: uppercase labels, section kickers, compact metadata.
- `Kicker`: short eyebrow accents.
- `BodyText`: supporting narrative copy.

Tailwind overrides are acceptable for context-specific sizing, not for replacing semantic typography intent.

### Primitives (`@auction/ui`)

| Component | Primary role |
|-----------|---------------|
| `Button` | Shared CTA and secondary actions |
| `FloatingLabelInput`, `PasswordInput` | Form input consistency |
| `SectionHeader` | Standard heading/action row |
| `LiveDot` | Live state affordance |
| `StatTile`, `KpiTile` | Compact metrics presentation |
| `PageHeader` | Page-level title/description framing |
| `DataTable`, `EmptyState` | Dashboard/admin list and empty handling |
| `StatusBadge` | Compact status communication |

### Pattern decisions

- **Lot cards (marketing/sale)**: image-led tile, no heavy card container.
- **Panels (dashboard/settings/admin)**: flat panel with thin border and restrained emphasis.
- **List/table rows**: thin divider rhythm, compact chips, clear numeric alignment.
- **Header/footer**: shared shell language across web and account surfaces.

### Toasts (Sonner)

The global host is `@auction/ui`’s `Toaster`, mounted once from `apps/web` (see `apps/web/src/components/ui/toaster.tsx`). Imperative calls MUST go through `{ notify }` from [`apps/web/src/lib/ui/notify.ts`](../apps/web/src/lib/ui/notify.ts), not `import { toast } from "sonner"` (contract: [`apps/web/src/lib/ui/__tests__/sonner-import.contract.test.ts`](../apps/web/src/lib/ui/__tests__/sonner-import.contract.test.ts)).

| API | When to use | Notes |
|-----|-------------|--------|
| `notify.success` | Action completed, no follow-up | Default duration 6s (matches host). |
| `notify.info` | System pushed info you did not request | **Must** pass `id` for dedupe (e.g. realtime inbox: `inbox-${n.id}`). |
| `notify.warning` | Expected adverse outcome, not a failure | Polite; e.g. outbid on a lot. |
| `notify.error` | Mutation/auth failure, user must read | Default duration 8s. |
| `notify.promise` | Long async with clear outcome | Prefer for slow staff actions when you adopt it. |

Conventions:

- **Title vs description**: short title (often verb + object); optional description for detail. Do not toast field-level validation errors — keep those on the form; `useActionForm` already toasts only the root error.
- **Dedupe**: pass a stable `id` when the same toast could fire repeatedly (`admin-cannot-buy`, inbox websocket, outbid).
- **Not toasts**: URL-driven banners (e.g. auth required, welcome back) stay as bespoke fixed UI, not Sonner.

## Icons

Use Lucide via `MaterialIcon` (`apps/web/src/components/ui/material-icon.tsx`) for consistency and bundle hygiene.
When adding a glyph, register it through the existing map.

## Engineering conventions (SOLID-oriented)

- **SRP**: separate view/controller/service responsibilities.
- **OCP**: extend shared variants/components instead of rewriting controls per page.
- **DIP**: use interface-driven service layers for form submissions and API operations.
- **LSP**: keep form-compatible component contracts (refs, native props).

## Future feature checklist

Before opening a PR for a new feature/page:

1. **Surface fit**: classify the page as marketing, detail, catalog/list, or dashboard/account recipe.
2. **Token usage**: use semantic tokens only; no ad-hoc color constants for shared surfaces.
3. **Layout rhythm**: validate container width, header offset, and section spacing against reference pages.
4. **Component reuse**: prefer existing `@auction/ui` and layout primitives before creating new UI atoms.
5. **State clarity**: loading, empty, error, success, and disabled states are visible and consistent.
6. **Responsive behavior**: desktop + mobile behavior is intentional, especially nav, tables, and action density.
7. **Dark mode**: verify contrast and readability in both themes.
8. **Accessibility**: focus visibility, labels, aria semantics, keyboard navigation.
9. **SEO/metadata**: route metadata and JSON-LD where applicable.
10. **Performance**: avoid unnecessary client components; optimize image strategy and bundle size.

## Performance checklist

- LCP-critical media: `next/image` with proper `priority` and `sizes`.
- Keep non-essential interactive islands lazy.
- Prefer server components; use `"use client"` only where interaction needs it.
- Keep font usage intentional and minimal.

## SEO checklist

- `metadata` / `generateMetadata` on each public route.
- Reuse metadata builders from `lib/seo/metadata-factory.ts`.
- Include relevant JSON-LD from `lib/seo/structured-data.ts`.
- Maintain one primary `h1` and `id="main-content"` for skip-link flow.
- Keep `robots.ts` and `sitemap.ts` aligned with new public URLs.

## Accessibility checklist

- Visible focus indicators on interactive elements.
- `aria-label` for icon-only controls; decorative icons marked `aria-hidden`.
- Form validation/errors are announced clearly.
- Preserve logical heading order and landmark semantics.
