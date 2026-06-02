# Catalog public visibility

How draft and non-public catalogue records are hidden from marketing surfaces while remaining available to catalogue staff.

## Status → surface matrix

| Status | Public marketing | Admin / catalogue |
|--------|------------------|-------------------|
| `draft` | Hidden | Visible to staff with `auction.manage` or `catalogue.write` |
| `scheduled`, `active` | Browse (home, search, saleroom) | Visible |
| `ended` | Archive / explicit `status=ended` only | Visible |
| `cancelled`, `voided` (lots) | Hidden | Staff tooling |
| `cancelled` (sales) | Hidden | Staff tooling |

## Enforcement layers

1. **Policy module** — [`packages/validators/src/catalog-public-visibility.ts`](../../packages/validators/src/catalog-public-visibility.ts): status sets, list resolvers, `isPublicCatalogLot`, staff preview gate.
2. **API** — `listLotsForPublicApi` / `listSalesForPublicApi` apply browse allowlists; anonymous list queries set `requirePublicParentSale` in SQL; saleroom uses `listCatalogLotsBySalePage` (filter + paginate in SQL).
3. **Web belt** — Home lot pool filters via `isPublicLotStatus`; marketing pages call public API only (no redundant per-sale fetches on home).

## Staff preview

Authenticated users with `auction.manage` or `catalogue.write` may request draft status filters and open draft lot/sale detail URLs. Anonymous callers receive **404** on non-public detail (not 403).

## Standalone lots

Lots with `saleId = null` and a public status (`scheduled`, `active`, or `ended`) are visible on browse surfaces. There is no parent sale to evaluate.

## Saleroom pagination

`GET /sales/:id/lots` paginates in SQL:

- **Anonymous:** inner-join sale, filter public sale + public lot statuses, accurate `total`.
- **Staff preview:** all lots on the sale, paginated in SQL without public filters.

## Manual smoke checks

- Home with 0 active lots: Editor's Picks shows scheduled only, never draft.
- `/search` default: scheduled + active only.
- `/archive`: ended only.
- Direct draft lot/sale URL: 404 anonymous; 200 when logged in as catalogue staff.
- Home network tab: no burst of `GET /sales/{id}` during SSR.
