# Shop + lax.art on a dedicated Stripe test account (interim)

Use this when the business has **not** created the final LAX Art org account yet, but you want Shop and lax.art off the **Bid** sandbox (`London Auction Xchange LTD`).

**Target:** Repurpose the unused org account (Dashboard name e.g. “Test mode”) → rename to **London Art Test** → wire **shop-api only**. Bid `STRIPE_*` on `apps/api` stays on the LAX LTD account.

## 1. Stripe Dashboard (you)

1. Organization account switcher → open the **unused** account (not London Auction Xchange LTD).
2. Settings → rename display name to **London Art Test** (optional, cosmetic).
3. Ensure **Test mode** is on.
4. **Connect** → enable / complete platform setup if prompted (Custom accounts, same model as Shop runbook).
5. Developers → **API keys** → create a **restricted** test secret (`sk_test_…`) with at least:
   - Checkout Sessions (Write)
   - Refunds (Write)
   - Connect (Write / manage accounts as required by your Connect setup)
   - Webhook Endpoints (Write)
6. Copy **Publishable key** (`pk_test_…`) from the same account.

## 2. CLI login for the Art account (you)

```bash
stripe login --project-name london-art-test
```

Complete browser auth while the **London Art Test** account is selected in the Dashboard.

## 3. Provision webhooks + GitHub secrets (automated script)

From monorepo root, using the **Art account** restricted key (not Bid’s):

```bash
cp scripts/ci/london-art-test-stripe.env.example .local/london-art-test-stripe.env
# Edit .local/london-art-test-stripe.env with sk_test / pk_test from London Art Test sandbox.

export LAX_ART_TEST_STRIPE_ENV_FILE=.local/london-art-test-stripe.env
export UPDATE_GITHUB_SECRETS=1

node scripts/ci/provision-lax-art-test-stripe.mjs --validate-only
node scripts/ci/provision-lax-art-test-stripe.mjs
```

The script:

- Refuses to run if the key resolves to the Bid sandbox account id `acct_1TU4J13Bcac3pHk5`.
- Creates (or reuses) webhooks on `https://test-shop.lax.bid/webhooks/stripe` and `…/webhooks/stripe/connect`.
- Updates GitHub **test** secrets: `STRIPE_SHOP_SECRET_KEY`, `STRIPE_SHOP_WEBHOOK_SECRET`, `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET`, `STRIPE_SHOP_PUBLISHABLE_KEY`.
- Sets GitHub **test** variable `STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art`.

**Do not** change `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, or Bid webhook secrets (those stay Bid-only).

## 4. Deploy

1. Merge **auction-infra** changes that pass `stripe_shop_publishable_key` and `stripe_shop_connect_platform_key` to shop-api (if not already on main).
2. Run **App deploy test** or **Terraform apply test** (ephemeral) so shop-api picks up new env.
3. Verify:
   - `curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://test-shop.lax.bid/webhooks/stripe` → **400**
   - Same for `/webhooks/stripe/connect`
   - Signed-in payee: Connect config returns a **non-null** `publishableKey` matching London Art Test `pk_test_…`

## 5. Data / payees

Connect rows keyed `bid_sandbox` from the shared-account phase **stay** in Postgres. Payees must **onboard again** on `lax_art` after cutover.

When the formal LAX Art production account exists, repeat key + webhook rotation per [lax-art-production-launch.md](./lax-art-production-launch.md); do not reuse Bid sandbox connected accounts.
