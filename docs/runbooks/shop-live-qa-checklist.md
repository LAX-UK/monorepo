# Shop + lax.art live QA checklist

Use after migrations **0182–0210** are applied and phase flags match the target environment. Record workflow run IDs and `/health/ready` SHAs.

## Client (collector)

- [ ] Sign in on Shop (`/account`) and lax.art account shell; email verification gate behaves as on test.
- [ ] **Collection** lists owned editions and assigned originals (`GET /v1/me/collection` via BFF).
- [ ] **Enquiries** shows open enquiry rows after registering interest with `intent=enquiry`.
- [ ] **Documents** download URLs work when S3 document storage env is configured.
- [ ] Print checkout smoke: basket → Stripe redirect → webhook paid order visible on `/account/orders`.

## Artist

- [ ] Artist portal links (`/account/artworks`, `/account/artist-sales`) when identity linked in admin.
- [ ] Sale authority request flow from `/account/sale-limits`.

## Staff (Shop Admin)

- [ ] Original sale: reserve → issue invoice → mark paid via Stripe test `invoice.paid` → status **assigned**.
- [ ] Merchandise create + stock adjust when `SHOP_MERCHANDISE_ENABLED`.
- [ ] Hold create/release when `SHOP_THIRD_PARTY_ENABLED`.
- [ ] Payout mark-paid when `SHOP_PAYOUTS_ENABLED`.

## Cross-product

- [ ] LAX Account **Payout accounts** shows launch links only (Bid + LAX Art URLs from env).
- [ ] LAX Art Connect onboarding opens from Shop `/account/payouts` when payouts enabled; after completing it the panel shows **Ready** (requires the Connect webhook endpoint and `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET`).
- [ ] With `SHOP_CONNECT_TRANSFERS_ENABLED=true`, a `due` payout for a ready payee becomes **Paid** with a `tr_…` reference, and staff mark-paid on that line returns 409.

## lax.art (test-art.lax.bid)

- [ ] Home and `/artworks` load seeded `salesChannel=art` catalogue; grid/list toggle and filters persist in the URL.
- [ ] Artwork detail: enquiry sheet (signed-in submit), share/copy fallback, favorite heart persists after reload.
- [ ] Artist profile: follow toggles and filters works by `artistSlug`.
- [ ] Search: `q` returns results and empty state when no matches.
- [ ] Account tabs: Inquiries (after enquiry), Collection (after assigned original), Favorites, Profile read-only with **Edit in LAX Account**, Payouts when `SHOP_PAYOUTS_ENABLED`.
- [ ] Dark mode toggle persists (`lax_theme` cookie + `html.dark`).
- [ ] Sign out on lax.art does not sign out Shop; sign out on Shop does not sign out lax.art.
- [ ] OIDC login round trip: `/login` → auth → `/auth/callback` → `/account`.
- [ ] **Originals journey (Phase 4):** client enquiry on lax.art → staff reserve/issue/pay in shop-admin → work appears in Collection on **both** test-art and test-shop; notification links use test-art URLs.

## Sign-off

- [ ] Two consecutive **Shop staging acceptance** runs green with `seed_catalogue=true` after each flag flip.
- [ ] Residual risks documented in [shop-v1-phase-gates.md](./shop-v1-phase-gates.md).
- [ ] Sentry test environment: no unresolved issues for shop, shop-api, shop-identity, art, account, auth, api, web (query via Sentry MCP or dashboard).
