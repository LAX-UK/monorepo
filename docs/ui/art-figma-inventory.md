# lax.art Figma inventory (MVP)

Design source: [LAX.art rebuild](https://www.figma.com/design/JvWqZrAeu8r8fs5EfjDlRc/LAX.art-rebuild).

This inventory maps shipped MVP routes in `apps/art` to Figma frames referenced in the lax.art implementation plan.

**Theme contract.** Use semantic tokens from `apps/art/src/app/base.css` only (same semantic/theme contract as Shop: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.). `base.css` is the only Art stylesheet and the only file allowed raw hex; palette utilities in `.tsx` are rejected. Enforced by `verify-art-theme` (`scripts/ci/verify-art-theme.test.mjs`, run in `pnpm ci:shop-architecture`). Light/dark preference persists via `ArtThemeInit` + `ArtThemeToggle`.

**Composition rule.** Controls come from `@auction/ui` / `@auction/marketing-ui` (see the Art "Apple model" rule and primitive audit in [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)); `scripts/check-ui-guardrails.mjs` rejects raw controls in `apps/art/src`.

## Routes

| Route / surface | Figma area (plan) | Page | Composer (`apps/art/src/lib/…`) | Key components |
| --- | --- | --- | --- | --- |
| Home `/` | Hero (`473:8994` desktop, `314:6636` mobile) + featured originals rail + artists | `app/(home)/page.tsx` | `home/home-page.composer.ts`, `home/art-home-hero.vm.ts` | `ArtHomeHero`, `ArtSection`, `ArtArtworkGrid`, `ArtArtistGrid` |
| Artworks hub `/artworks` | Catalogue browse (grid, filters, sort) | `app/artworks/page.tsx` | `catalogue/artworks-page.composer.ts` | `ArtworkCatalogueBrowse`, `ArtworkCatalogueFilterBody`, `MarketingFilterSheet` / `MarketingFilterSidebar` |
| Artwork detail `/artworks/[slug]` | PDP + enquiry sheet | `app/artworks/[slug]/page.tsx` | `artwork/artwork-detail-page.composer.ts` | `ArtEnquiryPanel`, `ArtEnquirySheet` (`MarketingSideSheet`), `ArtArtworkFavoriteToggle` |
| Artist profile `/artists/[slug]` | Artist header + works grid | `app/artists/[slug]/page.tsx` | `artist/artist-page.composer.ts` | `ArtArtistFollowButton`, `ArtArtworkGrid` |
| Search `/search?q=` | Search entry + results | `app/search/page.tsx` | `search/search-page.composer.ts` | `ArtSearchForm`, artwork + artist grids |
| Account profile `/account` | Account profile (read-only) | `app/account/page.tsx` | `account/account-page.composer.ts` | `ArtAccountShell`, LAX Account link (env-configured) |
| Enquiries `/account/enquiries` | Enquiries tab | `app/account/enquiries/page.tsx` | same | `ArtAccountListStateView`, `DotStatusPill` |
| Collection `/account/collection` | Collection tab | `app/account/collection/page.tsx` | same | `ArtAccountListStateView` |
| Favourites `/account/favourites` | Saved works / Followed artists | `app/account/favourites/page.tsx` | same | `ArtArtworkGrid`, `ArtArtistGrid` |
| Payouts `/account/payouts` | Mobile payouts (flagged: `SHOP_PAYOUTS_ENABLED`) | `app/account/payouts/page.tsx` | same (404 when flag off) | `ArtPayoutAccountPanel` + `@auction/shop-portal` VM |
| Login / register | Hosted identity handoff | `app/login/page.tsx`, `app/register/page.tsx` | `auth/art-auth-start.ts` | Redirects to art-identity with `returnTo` |
| Header + mobile bottom nav | Global chrome | `app/layout.tsx` | `layout/art-nav.vm.ts` | `ArtHeader`, `ArtMobileBottomNav` (`MarketingBottomTabBar`), `LaxProductSwitcher` |

## States

| State | Implementation |
| --- | --- |
| Loading | Route `loading.tsx` (root, artworks, artwork detail, artist, search, account) using `ArtCatalogueSkeleton` / `ArtCardGridSkeleton` / `ArtDetailSkeleton` / `ArtAccountSkeleton` with fixed aspect ratios (no CLS) |
| Empty | `ArtStatusState` (catalogue, search no results, favorites) and `ArtAccountListStateView` (account lists) |
| Error / unavailable | Composer `unavailable` results render `ArtStatusState`; per-section degradation on home; `app/error.tsx`, `app/not-found.tsx` |
| Signed out | Heart and enquiry route to `/login?returnTo=…`; detail `?enquire=1` reopens the sheet after sign-in |
| Enquiry outcomes | Inline `Alert` (focused) for sent / invalid / sign-in / error; field errors on message (1–2000) and phone (E.164) |

## Shared presentation primitives

`MarketingCardMedia`, `MediaImage` / `MediaImageServer` (via `ArtMediaImage`), `MarketingHeartToggle`, `MarketingSideSheet`, `MarketingBottomTabBar`, `@auction/branding` tokens, `@auction/lax-ecosystem` product switcher.

## Verification

- Unit: `pnpm --filter @auction/art test` (composers, VMs, validators, server actions with a fake BFF client).
- Browser: `apps/art/e2e/` journeys, `@a11y` axe on `#main-content`, viewport overflow audit at 375/1024/1440 (CI: `.github/workflows/art-e2e-pr.yml`; local: `scripts/local/start-shop-stack.sh` then `PLAYWRIGHT_E2E=1 pnpm --filter @auction/art test:e2e`).
