# Shop storefront architecture

Shop (`apps/shop`) is the LAX commerce storefront. It shares **Brand Identity v1.0** with Bid marketing (`apps/web`) and uses **Bid marketing chrome as the UI/UX authority** (typography, gutters, fixed header behavior, page/catalogue/detail shells, motion, focus, cards, footer rhythm). Shop keeps commerce IA (Collect, editions, catalogue BFF) and identity boundaries; it does **not** import `apps/web/**`.

## Boundaries

| Allowed | Forbidden |
|---------|-----------|
| `@auction/branding`, `@auction/lax-ecosystem`, `@auction/marketing-ui`, `@auction/ui`, `@auction/shop-contracts` | `apps/web/**`, `@auction/auth/server`, `@auction/shop-domain`, auction domain packages |

Section layout stays **BEM-first**. Stable style concerns are split across `base.css`, `header.css`, `home.css`, `catalogue.css`, `account.css`, `state.css`, and `footer.css`. Section headers, card chrome, focus, hover, and scroll reveal compose **`@auction/marketing-ui`** primitives. Use `@auction/ui` only where shoppers type, confirm, recover from errors, or see the shared catalogue-derived state motif—see [Design system — Multi-product UI stack](../DESIGN_SYSTEM.md#multi-product-ui-stack).

| Shop Identity BFF (`SHOP_IDENTITY_BASE_URL`, server-only) and public Identity chrome (`IDENTITY_PUBLIC_BASE_URL`) via `apps/shop/src/env.ts` | Bid saleroom, lots, watchlist UI |

**Local auth topology:** Shop Identity listens on `:3010` and sets the opaque `shop_identity_session` cookie (7-day lifetime). OIDC ID and refresh tokens live server-side on the session row after login or silent upgrade; the legacy `shop_identity_id_token` cookie is cleared on callback and is not written for new sessions. The storefront on `:3020` SSR-forwards session (and any legacy id-token) cookies to `GET /me`; when `/me` reports `tokenUpgradeRequired`, middleware redirects once through `/auth/upgrade` before commerce reads. Browser login still starts at the Identity BFF URL. This split is expected in local dev until a shared parent domain is configured.

**Commerce mutations (basket, checkout, orders):** server actions and SSR basket reads call the same-origin Next proxy at `/api/shop-identity/commerce/*`, which forwards cookies upstream and returns Shop Identity `Set-Cookie` (guest session, CSRF, basket token) to the browser. Direct server-to-server calls to `SHOP_IDENTITY_BASE_URL` are reserved for read-only account chrome (`/me`) that does not need cookie propagation.

See [Shop commerce boundary](../architecture/10-shop-commerce-boundary.md) and
[LAX ecosystem boundary](../architecture/11-lax-ecosystem-boundary.md) (product switcher,
session-aware header account VM).

## Layering (SOLID)

1. **Route composition** — `app/page.tsx` renders async `ShopHomePage`, which calls `composeHomePageData()` (Next BFF) then `buildHomePageViewModel()`.
2. **View models** — product-owned `src/lib/catalogue/*.vm.ts` shared by home and catalogue routes, plus home-only composition in `src/lib/home/*.vm.ts` (pure, Vitest).
3. **Content config** — `src/content/home-marketing.ts` (hero, section headings, signup; catalogue cards come from `shop-api`).
4. **Sections / cards** — `src/components/home/sections/*`, `src/components/home/cards/*` (server-first).
5. **Client islands** — `@auction/marketing-ui` header chrome (mega nav + Radix mobile drawer), Shop theme toggle, hero motion shell, `MarketingHorizontalRail` on home catalogue rows (native scroll + forward affordance), section reveals.
6. **Global footer** — Figma `full page` frame foundation (`1:601`), reduced to real MVP destinations only; placeholder policy/service/social links stay omitted until routes exist. When social chrome ships, compose `MarketingFooterSocials` from `@auction/marketing-ui` (Lucide + `LAX_SOCIAL_LINKS` from `@auction/branding`).

## Shared LAX contract (with Bid)

- **Typography:** Montserrat (primary), Outfit (supporting UI) via `next/font` — not DM Sans.
- **Colors:** `--color-brand-obsidian`, `--color-brand-midnight`, `--color-brand-light-gray`, `--color-brand-light-cream` from `@auction/branding`.
- **Focus:** `FOCUS_RING` from `@auction/branding` / `marketing-chrome.ts`.
- **Targets:** 44px minimum for icon and carousel controls.

## Shop-specific (product-owned)

- Commerce content, catalogue view models, and section composition (originals, prints, artists, categories rails) remain Shop-owned; layout rhythm follows [Marketing design language](../marketing-design-language.md) containers and section spacing, not a separate Figma-only scale.
- **Responsive anchor:** primary layout fork at **`lg` / `64rem` (1024px)**, matching Bid marketing and ecosystem breakpoints.
- **Motion contract:** `ShopReveal` (`@auction/marketing-ui`) + hero panel/layer CSS; `MarketingHorizontalRail` respects `prefers-reduced-motion` for programmatic scroll; `prefers-reduced-motion` zeroes reveal animation while keeping content visible without JS.
- **Card rails:** `@auction/marketing-ui` `MarketingHorizontalRail` — hidden scrollbars, snap, right-edge fade, and a single forward control from `sm` while overflow remains (same contract as Bid Editor’s Picks). Mobile relies on native swipe/scroll; there is no bottom progress thumb or previous control.
- **Media carousels vs pagination:** hero and gallery strips use Embla arrows/dots; catalogue result sets use URL/page controls — not card rails.
- **Home hero height:** `.shop-home__hero` is capped with `clamp(22.5rem, 62svh/62dvh, 36rem)` so the first catalogue section (Originals) peeks above the fold without scrolling. Copy sits in `.shop-home__hero-panel` with `padding-top: calc(var(--header-height) + 2rem)` so content clears the fixed transparent header. Bid home may still use full-viewport hero math where its hero bleeds under the header offset.
- **Home section rhythm (Bid-aligned):** `apps/shop/src/app/base.css` defines `--section-spacing`, `--section-spacing-tight`, and `--section-spacing-loose` like Bid marketing. On `.shop-home--marketing`, inter-section spacing is **not** a flex `gap`; each catalogue band (`.shop-home__section`) uses **top-only** `padding-top: var(--section-spacing-tight)` and `padding-bottom: 0`. Card rails do not add extra bottom padding for section separation. The signup band is padded via its `ShopReveal` wrapper (`padding-top: var(--section-spacing-tight)`) so spacing matches catalogue bands without margin collapse on the nested `.shop-home__signup` card. This matches Bid home strips (`pt-[var(--section-spacing-tight)]`, `pb-0`).
- **Header chrome (Bid-aligned):** desktop account menu lives in the primary navigation row (with basket/theme/mobile menu), not the upper utility row. Only one desktop navigation surface is open at a time — mega menu **or** account dropdown. **Mobile drawer:** account actions are inline in the footer via `ShopMobileAuthSection` (Create account / Sign in for guests, or account links + Sign out when authenticated)—matching Bid’s `MobileAuthSection`, not a nested icon account dropdown.
- **Home data:** parallel fetches to `GET /v1/artworks`, `/v1/categories`, `/v1/artists` with `placement` filters; per-section degradation via `Promise.allSettled`.
- **`/artworks` catalogue:** URL state in `apps/shop/src/lib/catalogue/artwork-catalogue-params.ts` (`q`, category, artist, availability, `type`, `minPrice`/`maxPrice` in GBP, `sort`, cursor/back). Presentation uses shared `@auction/marketing-ui` filter chrome; facets live in Shop-only components. API list reads go through Shop API query params (`type`, price pence, sort, `totalCount`) with sort-aware cursors; numeric price filters apply only where `printPricePence` is set (POA/originals excluded). Home `placement` reads stay capped and do not use catalogue sort/count.
- **Catalogue routes:** artwork and artist hubs expose opaque-cursor paging; categories are capped and use `GET /v1/categories/:slug` for detail. All three families share card view models, metadata, not-found/error boundaries, and sitemap entries.
- **Shared media placeholders:** `ShopMediaImage` / `ShopMediaImageServer` wrap `@auction/marketing-ui` `MediaImage` with Bid-aligned hatch placeholders (`@auction/ui` `MediaPlaceholder`). Label SSOT: `src/lib/media/shop-media-labels.ts`.
- **Status presentation:** `src/lib/presenters/shop-status-presentation.ts` maps shop-contract enums to shopper-facing labels, optional explanatory hints, and `DotStatusPillTone`; catalogue badges and order history render `@auction/ui` `DotStatusPill`. `src/lib/presenters/artwork-availability.presenter.ts` owns edition/original copy and meter data so API vocabulary never leaks into routes. Shop `base.css` mirrors Bid semantic status tokens; drift is guarded in `packages/branding/tests/shop-status-tokens.test.ts`.
- **BFF contract validation:** catalogue reads in `apps/shop/src/lib/shop-api.server.ts` and commerce/interest reads in `shop-commerce.server.ts` / `shop-artwork-interest.server.ts` parse upstream JSON with `@auction/shop-contracts` before building view models. Shop Identity commerce proxies forward shop-api JSON without re-parsing; malformed catalogue payloads become typed BFF failures at the storefront server boundary.
- **Cache contract:** Next reads use five-minute revalidation and resource tags (`shop:artworks`, `shop:categories`, `shop:artists`) plus `shop:catalogue`; catalogue API responses use ETag and shared-cache directives while errors and non-catalogue responses are `no-store`.
- **Remote catalogue media:** production HTTPS hostnames must be explicitly allowlisted with `SHOP_IMAGE_REMOTE_HOSTS`; local `/shop/**` assets require no allowlist.
- **Environment boundary:** runtime server modules read configuration through `src/env.ts`. `next.config.ts` is the deliberate build-time exception for `SHOP_IMAGE_REMOTE_HOSTS`, because Next must construct its image allowlist before the application module graph runs.
- **Failure semantics:** catalogue route errors render retryable segment error UI; successful empty reads remain distinct from upstream failures and true 404s. Commerce/account routes use `ShopStatusState`, a compatibility wrapper over `@auction/marketing-ui` `MarketingStatusState`. **Live-region contract:** first-paint server placards use `announcement="none"` (headings in document flow); client-side transitions opt in via `announcement="polite"` or `"assertive"`. Home catalogue rail empties/errors sit in a persistent polite `role="status"` wrapper so `router.refresh()` retries are announced without marking the placard itself as alert. Degradation **banners** use the compact `banner` layout with assertive announcement. Error vs. empty is distinguished by motif (alert vs. gallery), copy, and retry affordances—not by `role="alert"` on SSR markup. `ShopStateMotif` re-exports the shared hatched plate for artwork detail states. Shared shell CSS is imported from `@auction/marketing-ui/marketing-ui.css`; Shop-only page title scale tweaks remain in `state.css`. Artwork detail keeps no segment `loading.tsx` per architecture gate.
- **Session-aware CTAs:** server routes resolve `loadShopViewerState()` (same vocabulary as header account chrome) before rendering register prompts on artwork detail and footer links. The home signup promo under Featured Artists is always shown; its button is guest **Sign Up**, authenticated **My account**, or omitted when session status cannot link anywhere useful. Notify-me controls remain sign-in-gated on artwork detail.
- **Notify-me:** unavailable edition allocation exposes a sign-in-gated interest POST via Shop Identity commerce proxy → `shop-api` `/v1/artworks/:slug/interest`, persisting `shop_artwork_interest` and emitting `shop.artwork.interest_registered` domain events. When `SHOP_SCHEDULER_ENABLED` is true and notification email is configured, the `notify-me-dispatch` scheduler task sends queued interest alerts via the Shop notification publisher; otherwise interest is stored and events emitted without outbound email.
- **Artwork detail:** product-owned two-column shell with real media when available, an honest missing-image treatment, and aligned error/not-found states. Home and artwork routes intentionally avoid segment `loading.tsx` boundaries so their primary server-rendered content remains available without JavaScript.
- Header chrome matches Bid marketing (fixed utility row, product switcher, mega menu, theme toggle, session utility). Search and wishlist stay omitted until those slices ship. **Basket** is a bag icon link to `/basket` with an optional count badge in the primary navigation row beside theme and account (all viewports); it reflects the persistent basket via Shop Identity commerce proxy. The mega menu is Shop-owned IA (Collect / Artists catalogue destinations), not Bid auction/sell routes. Theme is class-based `html.dark` with a Shop-local cookie/localStorage module. **Theme contract:** consumer CSS/TSX uses semantic tokens from `apps/shop/src/app/base.css`; raw palette literals and Tailwind gray/white/black utilities are forbidden outside `THEME_FIXED_CONTRAST` hero/scrim blocks (`scripts/ci/verify-shop-theme.test.mjs`).
- Currency/language controls are omitted from header chrome until localization ships (do not add non-functional selectors).

## Verification

- `pnpm --filter @auction/shop test`, `lint`, `typecheck`, `build`
- `packages/branding` token drift includes `apps/shop/src`
- `pnpm ci:shop-architecture` — SSOT files and Shop UI gates
- Playwright (`PLAYWRIGHT_E2E=1`, base URL `http://localhost:3020`) — axe on `#main-content`, `e2e/shop-viewport-audit.spec.ts`, theme contrast in `e2e/theme-audit.spec.ts`, buyer/notify-me `@e2e` journeys, and hosted-auth keyboard flows. PR CI runs the full Shop suite (`.github/workflows/e2e-pr.yml`); no screenshot baselines.
