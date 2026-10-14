# Shop and Art end-to-end audit (2026-10-14, test)

Read-only audit of test-shop.lax.bid and test-art.lax.bid at release `9bc3c8b63` (#515), plus a cross-site consistency pass with Bid (test.lax.bid). Nothing in this document is fixed yet; fixes wait for approval of the PR grouping below.

The only writes were real-user actions: an Art favourite (reverted), follow (reverted), artwork enquiry, general enquiry, and one Stripe test-card purchase (order `d701e66d`, Harbor Print edition #1, user1@lax.bid).

## Baseline

| Service | Host | Release |
| --- | --- | --- |
| art | test-art.lax.bid | `9bc3c8b63` |
| art identity | dependency of art | `06768111c` |
| shop / shop-api / auth / shop-admin | test-shop, test-auth, test-shop-admin | `9bc3c8b63` |

Flags on test (GitHub `test` environment; unset falls back to `false` in `terraform-apply-test.yml`): `ART_EDITORIAL_ENABLED`, `SHOP_EDITORIAL_ENABLED`, `SHOP_ADMIN_ENABLED`, `SHOP_PAYOUTS_ENABLED` = true; `SHOP_ORIGINALS_ENABLED`, `SHOP_MERCHANDISE_ENABLED`, `SHOP_THIRD_PARTY_ENABLED`, `SHOP_CONNECT_TRANSFERS_ENABLED` = false. The originals journey via shop-admin was skipped because `SHOP_ORIGINALS_ENABLED` is off.

Sentry: no new issues during the audit, but org `lax-bid` has projects only for Bid. Art, Shop, shop-api and shop-admin errors are not reported anywhere (see finding 13).

## Findings

| # | Severity | Finding | Repro | Proposed fix |
| --- | --- | --- | --- | --- |
| 1 | P0 (regression from #515) | Shop home **Originals** and **Shop by Category** rails collapse on desktop: cards render ~38px wide with text stacked vertically. | Desktop ≥ the `home.css` desktop breakpoint, open `/`, scroll to Originals. | `home.css:524-538` sizes cards with `calc((100% - Nrem) / N)`; `MarketingCardReveal` (added in `originals-section.tsx`, `categories-section.tsx`) is now the flex item, so the percentage resolves against a shrink-to-fit wrapper. Move the width rule onto the reveal wrapper (`.shop-home__scroll-row > .reveal`) and make the card `width: 100%`. Add a desktop Playwright assertion on card width. |
| 2 | P0 | Shop **artwork detail** on desktop: image column collapses to ~64px and overlaps the title and price. | `/artworks/harbor-print` at 1440px. | `artworks/[slug]/page.tsx:116` passes `contentClassName="shop-detail"` and the inner `<article>` is also `.shop-detail` — two nested 2-column grids. Drop the outer `contentClassName`. Pre-existing since #503. |
| 3 | P0 (SEO) | Shop canonical, `og:url`, robots `Sitemap:` and every sitemap `<loc>` are `http://localhost:3020`; Shop is also indexable on test (`Allow: /`, no `noindex`; Lighthouse SEO 100). | `curl https://test-shop.lax.bid/robots.txt` | Config: set `LAX_SHOP_STOREFRONT_URL` on the Shop storefront (infra-config). Code: make `loadShopStorefrontBaseUrl()` (`product-directory.server.ts:44`) throw in production instead of falling back to localhost, and add the non-production `noindex` / `Disallow: /` switch Art already has (`art-robots.ts`). |
| 4 | P0 | Shop **Collection** and **Enquiries** show only "Try again" for users with nothing there. | Sign in as user1 before any purchase → `/account/collection`, `/account/enquiries`. After a purchase Collection lists the edition, confirming the empty path. | `fetchPortalList` returns `status: "empty"` (`create-portal-fetchers.ts:119`); `collection/page.tsx:72` and `enquiries/page.tsx:77` treat any non-`ok` as failure. Branch on `empty` / `commerce_unavailable` like `editions/page.tsx`. |
| 5 | P1 (config) | Shop **Payouts / Documents / Sales** tabs are hidden and their routes render "Page not found", while the API and Art have payouts on (Art `/account/payouts` works). | user1 → `/account/payouts`. | Shop storefront app spec is missing `SHOP_PAYOUTS_ENABLED=true` (only shop-api / art receive it). Add it in infra-config. |
| 6 | P1 (SEO) | Shop **soft 404s**: `/merchandise` (flag off), `/artists/<unknown>`, `/categories/<unknown>`, `/merchandise/<unknown>`, `/account/*` not-found pages return HTTP 200 (noindex is set). Art returns real 404s. | `curl -I https://test-shop.lax.bid/artists/nope` | `loading.tsx` in those segments makes `notFound()` stream after a 200. Resolve not-found before the Suspense boundary (as Art's `page-status.ts` does) or drop segment `loading.tsx` for detail routes. |
| 7 | P1 | Art **legal pages 404**: `/legal/cookies` (linked from the cookie banner), `/legal/{shipping,returns,modern-slavery,accessibility}`; `/cookie-policy` 301s into the 404. Seeded Privacy and Terms are explicit placeholders ("Replace … before launch"). | Open `/legal/cookies`. | Content: publish real Privacy, Terms, Cookies (minimum) in editorial; seed `cookies` in `editorial-showcase-seed.ts`. Stop redirecting legacy URLs to unpublished slugs. |
| 8 | P1 | Shop **artist portraits broken**: Emmett King, Elias Moore, Juno Frost return 500 from `/_next/image`; five more artists show the placeholder on Shop but a portrait on Art. | `/artists` on Shop. | Seed uses Art-relative paths (`/art/seed/artist-*.webp`) that exist only in `apps/art/public`. Seed absolute lax-media CDN URLs. |
| 9 | P1 | Order summary labels a print's subtotal **"Merchandise"**. | `/account/orders/<id>` or confirmation page. | `shop-order-summary.tsx:88` hardcodes `<dt>Merchandise</dt>`; use "Subtotal" (matches checkout). |
| 10 | P1 | Art **Field Notes** says "Original work — one of one / unique piece" and Details says "Print · Limited edition". | `/artworks/field-notes`. | Seed (`art-originals-seed.ts:188-201`) marks an original as `limited_edition`; fix seed. Commerce presenter should not claim "one of one" when rarity says otherwise. |
| 11 | P1 | Payout copy promises automatic bank payouts while `SHOP_CONNECT_TRANSFERS_ENABLED=false` (scheduler task not registered). | Payouts page with a ready Connect account. | `payout-account.vm.ts:45-48`: expose transfers-enabled from API config and adjust copy. |
| 12 | P1 (security, decision) | **Staff 2FA** enforced on Shop (admin@lax.bid is sent to authenticator setup) but not on Art — the same staff account signs into Art with password only. | Sign into Art as admin@lax.bid, then open Shop. | Decide policy per client; if staff must always use 2FA, enforce on `lax-art-web` too. |
| 13 | P1 (ops) | **No error monitoring** for Art, Shop, shop-api, shop-admin: server-only Sentry init in Art/Shop (`instrumentation.ts` → `sentry.server.config.ts`), no client/edge config or `onRequestError`; test has only `SENTRY_DSN_WEB`; no Sentry projects exist. | Sentry org project list. | Create projects, add `SENTRY_DSN_{ART,SHOP,SHOP_API}` secrets, add client/edge config + `onRequestError` + `global-error.tsx`. |
| 14 | P1 (content) | Shop **categories** are Bid's taxonomy: Art, Watches, Coins & Medals; the "Art" tile uses a coin image. | `/categories`. | Shop-specific category seed and imagery (e.g. Prints, Photography, Works on paper). |
| 15 | P1 | Shop Collection always links to `/account/documents`, which 404s when payouts are off. | `/account/collection` footer copy. | Gate the link on `isShopPayoutsEnabled()` (`collection/page.tsx:111-115`). |
| 16 | P1 | Shop footer has no **Terms / Shipping / Returns** for a site that takes payment; only Bid Privacy + Cookies. | Shop footer. | Link Bid Conditions of Business + Shipping, add a returns policy (folds into footer unification). |
| 17 | P2 | Shop home `Originals` rail renders regardless of `SHOP_ORIGINALS_ENABLED`; catalogue outage copy mentions "editorial content below" that Shop doesn't have. | `home-page.composer.ts:27-29`, `catalogue-status-section.tsx:15`. | Decide originals visibility; remove the stale copy. |
| 18 | P2 | Basket merge **sums** quantities: guest 1 + saved 1 → 2 of the same limited edition after sign-in. | Add as guest, sign in with an existing basket line. | Merge with `max(guest, saved)` per edition line, or show a "we merged your basket" notice. |
| 19 | P2 | Collection shows raw status strings ("Edition 1 · sold · unprinted"). | `/account/collection` after purchase. | Map statuses to labels ("Sold", "Awaiting print"). |
| 20 | P2 | Hosted auth login violates its own CSP (inline script refused: `script-src 'self' https://challenges.cloudflare.com`). | Console on test-auth `/login`. | Nonce/hash the inline script or move it to a file (lax-identity). |
| 21 | P2 | After Art sign-out the URL keeps `?state=…`. | Sign out on Art. | Strip OIDC params on the post-logout landing. |
| 22 | P2 (perf) | Mobile Lighthouse medians (3 runs): Bid perf 63 / LCP 4.4s / TBT 510ms; Shop 74 / 5.0s / 108ms; Art 72 / 5.5s / 201ms. `/_next/image` responses are `max-age=60` and Cloudflare `DYNAMIC` (never edge-cached). | `curl -I` any `/_next/image` URL. | Set `images.minimumCacheTTL` (seed/CDN assets are immutable) and a Cloudflare cache rule for `/_next/image`; Bid home also has two 403 console errors and no meta description on test. |
| 23 | P2 | Art home: exhibition, story, collector-guide and Rowan Hale cards show the striped "no image" placeholder. | `/` on Art. | Seed cover media. |
| 24 | P2 | Art hero card: translucent beige panel, dark text over photography, navy link — weak contrast; in dark theme text stays dark. | `/` on Art, both themes. | Solid surface token or gradient scrim; theme-aware text tokens. |
| 25 | P2 | Titles: Shop home `<title>` is just "LAX Shop"; Shop `/session-expired` "LAX Shop"; "Sign in · LAX Art" uses `·` while others use `|`; 404 pages titled only with the brand. | Page titles. | One title template per site. |
| 26 | P2 | a11y: Art `/visit` has a link with no accessible name; Shop category tiles repeat the name in `alt` (Lighthouse `image-redundant-alt`). | Lighthouse / DOM. | Label the link; `alt=""` on decorative tiles. |
| 27 | P2 | Favourite/follow failures are announced to screen readers only — no visible error. | `use-favorite-toggle.client.ts:51-54`. | Inline error or toast. |
| 28 | P2 | Art mobile menu button only opens (always "Open menu"); Bid/Shop toggle open/close. | `art-header.client.tsx:159-168`. | Use the shared toggle. |
| 29 | P2 | Shop basket stepper is offset from the page title column; out-of-stock basket line offers a disabled "Set quantity to 1" instead of "Remove"; international checkout is `mailto:` only. | `/basket`, `/checkout`. | Align stepper; swap CTA; persist international quote requests as enquiries. |
| 30 | P2 | e2e gaps: Art contact submit, account collection/inquiries, follow, legal, stories, preview; Shop desktop home rails, detail layout, empty Collection/Enquiries, payouts/documents, cancel, soft-404 status codes. | `apps/{art,shop}/e2e`. | Add specs alongside the fixes above (1, 2, 4, 6 at minimum). |

## Coverage matrix

| Area | Art | Shop |
| --- | --- | --- |
| All public routes, desktop 1440 + mobile 375 (status, console, network, images, overflow, reveals) | 30 routes ✅ — 404s in #7 | 21 routes ✅ — #1, #2, #6, #8 |
| Detail pages (artworks, artists, exhibitions, stories, visit, collector hub) | ✅ (#10) | ✅ (#2) |
| Search / filters / sort | ✅ search hit + no-hit; catalogue filters render | ✅ catalogue filters render |
| Unknown slugs → 404 | ✅ | ❌ #6 |
| OIDC sign-in round trip | ✅ admin@lax.bid | ✅ user1@lax.bid (admin needs staff 2FA setup — not done) |
| Account tabs | ✅ Profile, Inquiries, Collection, Favorites, Payouts | ✅ Overview, Orders, Editions, Sale limits, Artist sales, My artworks; ❌ Collection/Enquiries (#4); hidden Payouts/Documents/Sales (#5) |
| Favourite + follow | ✅ toggle and revert | n/a (no UI) |
| Artwork enquiry → appears in account | ✅ | n/a |
| General enquiry (contact) | ✅ | n/a |
| Basket guest → sign-in merge | n/a | ✅ (#18) |
| Stripe test checkout → webhook → Paid → order detail → collection/editions | n/a | ✅ order `d701e66d` (#9) |
| Checkout cancel link | n/a | ✅ invalid-link state |
| Sign-out and protected-route redirect | ✅ (#21) | ✅ |
| Originals journey via shop-admin | skipped — `SHOP_ORIGINALS_ENABLED=false` | skipped |
| Sentry diff | no Art/Shop projects (#13) | no Shop projects (#13) |
| Lighthouse mobile | #22 | #22 |

## Consistency across Bid, Shop and Art

Footer (owner request: no tagline anywhere):

| Concern | Bid (`apps/web/.../site-footer.tsx`, own component) | Shop / Art (`MarketingFooter`) |
| --- | --- | --- |
| Tagline | none rendered (unused optional prop) | italic tagline top-right (`shop-footer.vm.ts:56`, `art-footer.vm.ts:77`; required prop `marketing-footer.tsx:17`) |
| Background / container | white, `bg-footer-bg`, 1440px | grey `#ededef`, 90rem |
| Column headings | large bold Title Case | small letter-spaced caps |
| Columns | 5 (Our Services wraps alone) | Shop 4; Art 6 (Legal + Connect wrap unevenly) |
| Logo | top **and** bottom row, plus "London" line | top only |
| Guest CTA | — | Shop "Join us", Art "Join" (header says "Create account") |
| Legal | Conditions of Business, Privacy Notice, Cookie Policy, Shipping & Logistics, Legal, Cookie preferences | Shop: Privacy notice, Cookie policy; Art: Privacy notice, Terms of use |

Recommended single footer: `MarketingFooter` everywhere (Bid adopts it), no tagline, one container and background token, letter-spaced headings, columns = product navigation · Account · LAX products · Legal (Privacy notice, Terms, Cookie policy, Cookie preferences) · Connect, balanced to 4 columns on desktop, "Create account" wording, copyright row identical.

Other drift:

- Header: product switcher (LAX BID / ART / SHOP) is top-left on Bid and Shop, top-right on Art; search exists on Bid and Art but not Shop; Art's mobile menu button doesn't toggle (#28).
- Page headers: Shop `h1` light weight with subtitle; Art `h1` bold without subtitle; Bid uses its own `MarketingSectionHeader`. Three section-header implementations and two `LaxLogo` components.
- Copy: Art `/account/inquiries` "Inquiries" and `/account/favorites` "Favorites" (US) vs Shop `/account/enquiries` "Enquiries" and UI "Enquire" (UK). "Cookie preferences" (Bid) vs "Cookie settings" (Art). Title Case (Bid) vs sentence case (Shop/Art) legal labels.
- Cards: Art catalogue 1:1, Shop catalogue 4:5; Shop merchandise has its own `formatPricePence` next to `formatGbpPence`.
- Auth status pages: Shop "Sign in" vs Art "Sign in again" + "Continue browsing"; different titles for the same states.
- Cookie consent banner only on Bid (Shop/Art load no analytics today, so no compliance gap yet).

## UX enhancements (ranked by impact)

1. Fix the broken desktop layouts (#1, #2) — they are the first things a buyer sees.
2. Honest empty states with a next step on every account list (#4), and status labels instead of raw values (#19).
3. Shop search in the header (Art and Bid have it).
4. Art hero legibility (#24) and real cover media (#23).
5. Visible feedback for favourite/follow failures (#27) and a basket-merge notice (#18).
6. Unified footer and header chrome (consistency section), one page-header component, one card ratio per catalogue type.
7. Image caching for faster mobile LCP (#22).

## Proposed fix PRs

PR 0 is listed first because #1 is a live regression from #515; the footer unification then leads the consistency work as requested.

| PR | Scope | Findings |
| --- | --- | --- |
| 0 — Shop layout hotfix | Rail card widths on reveal wrapper; drop nested `shop-detail`; desktop Playwright width assertions | 1, 2 |
| 1 — Footer unification | `MarketingFooter` tagline removed (prop deleted), Bid adopts `MarketingFooter`, unified columns/labels/tokens, Shop legal links, Art cookie policy link | 16, consistency |
| 2 — Shop account correctness | Empty/unavailable states for Collection and Enquiries; documents link gating; "Subtotal" label; status labels; payout copy vs transfers | 4, 9, 11, 15, 19 |
| 3 — Shop SEO | Storefront base URL hard-fail in production, non-production `noindex`, real 404s for not-found routes, title template | 3 (code half), 6, 25 |
| 4 — Seed and content | Shop artist portraits as CDN URLs, Field Notes rarity, cover media, cookies legal page, Shop categories | 7 (seed half), 8, 10, 14, 23 |
| 5 — Chrome and copy consistency | Header switcher placement, Art menu toggle, Shop search, page header component, British spelling decision, auth status page copy | 26, 27, 28, consistency |
| 6 — Observability and perf | Sentry client/edge/onRequestError for Art and Shop; image cache TTL | 13 (code half), 22 |
| Config (infra-config, not this repo) | `LAX_SHOP_STOREFRONT_URL` and `SHOP_PAYOUTS_ENABLED` on the Shop storefront; Sentry projects and DSN secrets | 3, 5, 13 |
| Decisions needed | Staff 2FA on Art; Favourites vs Favorites; basket merge semantics; originals rail when the flag is off | 12, 17, 18, consistency |
