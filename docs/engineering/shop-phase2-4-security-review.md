# Shop Phase 2–4 security review (remediation diff)

Brief review of the Phase 2–4 remediation changes in `shop-api`, shared packages, and ops entrypoints. This is not a penetration test; it documents controls and residual risk for gate sign-off.

## Layering and boundaries

- **Routes → handlers → phase writers:** Admin HTTP routes depend on narrow `AdminRoutesDeps` and infrastructure handlers; Drizzle phase writers sit in `infrastructure/phase/*` and are composed in `container.ts`. Domain rules (capabilities, payout eligibility, VAT, possession bounds) remain in `@auction/shop-domain`.
- **Webhooks:** Stripe money events are parsed in `stripe-webhook.dto.ts`, orchestrated in `drizzle-stripe-money-webhook.processor.ts`, with refund/dispute side effects in dedicated handlers. Checkout session events stay on the existing commerce path.
- **Schedulers:** Refund submission, payout eligibility, hold expiry, identity merge inbox, and admin-command prune are registered only when the matching `SHOP_*_ENABLED` flags are true (`create-shop-api-scheduler.ts`).

**Residual risk:** Some handlers still cast `tx as Database` for nested helpers; a mistaken call outside the transaction could weaken isolation. Prefer passing transaction-scoped ports in a follow-up.

## Idempotency

- **Admin mutations:** `withAdminIdempotency` hashes request bodies, stores commands in `shop_admin_command`, and returns replay results or 409 on hash/key conflict. Actor-scoped primary key (migration **0201**) reduces cross-operator replay collisions.
- **Stripe webhooks:** `shop_processed_payment_event` claims `eventId` before side effects; refund rows use `idempotencyKey: stripe:{stripeRefundId}` and metadata `shop_refund_id` to correlate outbox rows with Dashboard-created refunds.
- **HTTP:** Admin routes require `Idempotency-Key` header where mutating (`require-idempotency-key.ts`).

**Residual risk:** Clients that omit or reuse idempotency keys across different payloads will see 409s or unintended replays; document key generation for CLI and future admin UI.

## Webhook ownership filter

- Checkout and session parsers require `metadata.app === "shop"`.
- Money webhooks (`refund.*`, disputes) resolve the shop order by `payment_intent`; if no order exists, optional `fetchPaymentIntentMetadata` plus `isShopOwnedPaymentIntentMetadata` prevents cross-product processing.
- Foreign or legacy events should return `ignored` / 2xx without DB writes.

**Residual risk:** Shared Stripe accounts during test phase increase mis-tagged metadata risk; prefer Shop-only restricted keys and explicit `app: shop` on all Shop payment intents before production cutover.

## CLI and break-glass controls

- **`shop-ops` CLI:** Requires `--operator` and `--reason`; finance subcommands gate on `SHOP_OPS_FINANCE_CLI_ENABLED` and active finance staff capability checks.
- **Legacy scripts:** `staff:grant`, `sale-authority`, seed scripts remain separate; production paths documented in [shop-v1-phase-gates.md](../runbooks/shop-v1-phase-gates.md).

**Residual risk:** Anyone with DB credentials and env access can bypass CLI audit; rely on infra access controls and `shop_admin_audit` / command table for API-path mutations only.

## Authentication and authorization (admin API)

- Admin scope registers under `/admin/v1` with bearer JWT verification, `shop.admin` scope, silver ACR, active staff, and capability checks per route.
- Finance-sensitive routes add recent `auth_time` step-up (`SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS`).

**Residual risk:** No first-party OIDC client ships `shop.admin` yet (admin UI deferred). Tokens must not be issued to untrusted clients; broker hold release IDOR and related items from the gate blocker list may still apply until explicitly closed.

## Data integrity migrations

- **0195–0201:** Refunded order statuses, payout ledger source FKs, refund outbox columns, admin command store, phase uniqueness indexes, identity merge inbox, actor-scoped command PK.

**Residual risk:** Enabling flags before migrations apply will fail at runtime; enforce migrate-before-flag in deploy pipelines.

## Recommended follow-ups (non-blocking for test)

1. Close documented gate blockers (hold IDOR, broker resolution, merchandise build-time flag, portal no-party behaviour).
2. Add integration tests for webhook processor + ownership filter with mocked Stripe metadata fetch.
3. Alert rules in [shop-phase2-4-alerts.md](../runbooks/shop-phase2-4-alerts.md) wired in observability.

## Sign-off checklist

- [ ] Layer boundaries reviewed (no domain imports from infrastructure in reverse).
- [ ] Idempotency paths exercised in CI (admin + refund webhook unit tests).
- [ ] Webhook ownership filter understood for shared vs dedicated Stripe account.
- [ ] CLI finance gates documented for operators.
- [ ] Residual risks accepted or tracked as gate blockers.
