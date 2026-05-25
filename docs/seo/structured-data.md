# Structured data (JSON-LD) catalogue

This document enumerates the JSON-LD payloads emitted by the marketing site and
the routes that own them. Helpers live in
`apps/web/src/lib/seo/structured-data.ts`. Use them when adding a new route so
the rich-result coverage stays consistent.

## Helpers

| Helper | Schema type | Notes |
|---|---|---|
| `organizationJsonLd()` | `Organization` | Root layout |
| `websiteJsonLd()` | `WebSite` + `SearchAction` | Root layout |
| `localBusinessJsonLd()` | `LocalBusiness` | About / contact |
| `breadcrumbJsonLd(items)` | `BreadcrumbList` | Per route |
| `itemListJsonLd(items)` | `ItemList` | Listing routes |
| `personJsonLd(opts)` | `Person` | Seller fallback (consignor user, not catalogue artist) |
| `visualArtistJsonLd(opts)` | `Person` + `VisualArtist` | Approved `artist_profile` rows (admin-curated, status=approved) |
| `lotProductJsonLd(lot, opts?)` | `Product` + `Offer` | Lot detail (uses `marketingDetails.estimate.currency` when present) |
| `saleEventJsonLd(sale)` | `Event` (online) | Sale detail |
| `faqPageJsonLd(items)` | `FAQPage` | FAQ |
| `jsonLdScript(...payloads)` | safe inline `application/ld+json` | All routes |

## Routes and emitted payloads

| Route | Payloads |
|---|---|
| `/` (root layout) | `organization`, `website` |
| `/sales` | `breadcrumb`, `itemList` |
| `/sales/[id]` | `breadcrumb`, `saleEvent`, `itemList` (lots) |
| `/lot/[slug]/[id]` | `breadcrumb` (Home › Sale › Lot when sale is known), `lotProduct` (with brand + seller when available) |
| `/artist/[slug]/[id]` | `breadcrumb`, `visualArtistJsonLd`, optional `itemList` (artist row resolved from the public `artist_profile` registry via `GET /artists/public`) |
| `/artist/[slug]/[id]` (seller fallback) | `breadcrumb`, `personJsonLd`, optional `itemList` (used only when the lot still has a legacy seller-only attribution and no canonical `lot.artist_id`) |
| `/faq` | `breadcrumb`, `faqPage` |
| `/about`, `/contact`, `/legal`, `/privacy`, `/shipping`, `/terms` | none beyond root payloads (they sit on the marketing shell which inherits root) |

## OG / Twitter cards

The marketing routes co-locate `opengraph-image.tsx` files generated with
`next/og`:

- `apps/web/src/app/(marketing)/opengraph-image.tsx` — homepage
- `apps/web/src/app/(marketing)/sales/[id]/opengraph-image.tsx` — sale catalogue
- `apps/web/src/app/(marketing)/lot/[slug]/[id]/opengraph-image.tsx` — lot detail
- `apps/web/src/app/(marketing)/artist/[id]/opengraph-image.tsx` — artist profile

Next.js automatically wires the same image into Twitter cards. The static
`SITE_LOGO_PATH` continues to act as the fallback OG image for routes without
their own `opengraph-image.tsx`.

## Verification

Use Google's [Rich Results Test](https://search.google.com/test/rich-results)
for each high-value route after deploys. Cross-check the sitemap with
`xmllint --format` to confirm no malformed entries land before search engines
crawl them.

For saleroom catalog / layout UI changes, see
[marketing-ui-seo-audit.md](./marketing-ui-seo-audit.md) and run the contract
tests under `saleroom-catalog-seo.contract.test.tsx`.
