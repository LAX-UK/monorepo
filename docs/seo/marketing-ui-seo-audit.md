# Marketing UI SEO audit (saleroom catalog & layout)

Audit of recent marketing UI work against the server-first SEO contract documented in
[`structured-data.md`](./structured-data.md). Automated guards live in:

- `apps/web/src/components/sections/saleroom/saleroom-catalog-seo.contract.test.tsx`
- `apps/web/src/lib/seo/structured-data.sale-catalog.test.ts`

## Baseline contract

| Rule | Rationale |
|------|-----------|
| Catalog data fetched on the server | Lot/sale HTML in initial response for crawlers |
| Tiles expose real `<Link href>` to canonical lot URLs | Quick look / watchlist are progressive enhancement only |
| JSON-LD + `generateMetadata` on route `page.tsx` | Rich results and index hygiene stay server-owned |
| Static chrome (footer) outside client providers | Stable SSR HTML and hydration for global links |

## Change-by-change audit (2026-05)

| Change | SEO impact | Status |
|--------|------------|--------|
| Equal-height saleroom grid (`saleroom-lots-grid`, `saleroom-lot-card`) | CSS/layout only; image + title links unchanged (`href={lot.href}`) | Compliant |
| Overlay timer + quick-look corners | Overlays sit on links; full lot pages remain separate routes | Compliant |
| React key / hydration fixes (overlay actions, footer layout) | DOM structure only; **SiteFooter moved outside `MarketingLotQuickLookShell`** improves SSR stability | Compliant (improvement) |
| LaxLogo SVG `unoptimized` | Prevents Next/Image SSR/client drift; `SITE_LOGO_PATH` in Organization JSON-LD unchanged | Compliant |
| Adaptive sale hero overlays | Metadata + JSON-LD still from server `sales/[slug]/[id]/page.tsx` | Compliant |
| `RevealInView` on grid cards | Content visible in SSR/no-JS until JS arms `data-reveal-init` (`globals.css`) | Compliant |

## Unaffected SEO surfaces (sale detail)

These remain the indexed source of truth and were not modified by layout work:

- `generateMetadata` + slug redirect in `apps/web/src/app/(marketing)/sales/[slug]/[id]/page.tsx`
- JSON-LD: `breadcrumbJsonLd`, `saleEventJsonLd`, `itemListJsonLd` (current page of lots only)
- `id="catalog"`, `MarketingLoadMore` pagination links, `revalidate = 0`

## Do not regress

- Move catalog fetching into client-only components
- Replace tile `<Link href={lot.href}>` with quick-look-only navigation
- Nest `SiteFooter` inside `MarketingLotQuickLookShell` again
- Remove sale-page JSON-LD or metadata for overlay UX

## Post-deploy manual checklist

Run on a live `/sales/:slug/:id` after deploy:

1. **View Source** (not DevTools Elements): confirm lot titles and `/lot/...` hrefs appear in raw HTML inside `#catalog`.
2. **[Rich Results Test](https://search.google.com/test/rich-results)**: validate `Event`, `ItemList`, and `BreadcrumbList` JSON-LD.
3. **Console**: no hydration errors on footer/logo (stable SSR output).
4. **JS disabled**: catalog image/title links still navigate to lot detail pages.

Automated CI covers crawlable links and JSON-LD shape; manual steps above validate production HTML and Google rich-result eligibility.
