# Shop audit findings (2026-10-07)

| Severity | Finding | Repro | Fix |
| --- | --- | --- | --- |
| Blocker | Test auth release `cb38505b` lacks `lax-shop-admin` in compiled OIDC registry → `invalid_client` on staff sign-in | Authorize with `client_id=lax-shop-admin` on test-auth | Identity staging deploy with lax-identity `23b6e0b93`, `stage_only=false`; workflow passes `OIDC_CLIENT_SECRET_LAX_SHOP_ADMIN` (this PR) |
| Blocker | Identity staging deploy never cut traffic after publish (`STAGE_ONLY=true` auto-dispatch) | Compare test-auth `/health/ready` release to lax-identity main | Manual dispatch with `stage_only=false` after workflow merge |
| High | Shop-admin `returnTo` open redirect via callback | `returnTo=https://evil.example` after login | `safeReturnTo` in login + callback (this PR) |
| High | Tier-1 smoke skipped all shop-admin staff specs (`seed_catalogue=false`) while auth client drift went undetected | shop-immutable-smoke green with broken shop-admin OIDC | OIDC preflight script + tier-1 step (this PR) |
| Medium | PR e2e OIDC registry omitted `lax-shop-admin` | `e2e-pr` configure-oidc only registers bid-web + shop-web | Register client + CI secret in `e2e-pr.yml` (this PR) |
| Medium | Shop-admin UX required extra click on `/login`; stale session dropped `returnTo` | Visit `/orders` unsigned → `/login` card | Middleware → `/api/auth/login`; layout re-auth with path (this PR) |
| Medium | Storefront `/account` guest card instead of immediate sign-in | Guest opens `/account` | Redirect to Shop Identity login (this PR) |
| Low | Hosted auth social buttons text-only; sign-up lacked social; OAuth `?error=` silent | Cancel Google sign-in on hosted login | Provider marks + shared `bindSocialSignIn` + `socialErrorMessage` (this PR; ships via lax-identity release) |
| Deferred | Two consecutive seeded acceptance runs on test | Dispatch shop staging acceptance `seed_catalogue=true` ×2 after auth fix | Track in CI after merge + auth redeploy |

Blockers marked fixed in-repo still require **Identity staging deploy** on test before staff sign-in is verified live.

## Cutover status (2026-10-08)

| Check | Result |
| --- | --- |
| test-auth `/health/ready` | `23b6e0b9374aba064b51d74cc232192b50b07026` (shop-admin OIDC authorize OK) |
| test-shop / test-shop-admin | `b338a8d7791645a3cdf64278a7944bdf2462e179` via [app deploy 37695136626](https://github.com/LAX-UK/monorepo/actions/runs/37695136626) (`deploy_shop=true`) |
| Identity directory + acceptance | Directory apply [37690830769](https://github.com/LAX-UK/monorepo/actions/runs/37690830769); acceptance [37691001587](https://github.com/LAX-UK/monorepo/actions/runs/37691001587) green |
| Monorepo #464 | Merged 2026-10-07 (identity deploy + staging-recovery hardening) |
| shop-admin layout cookie blocker | Fixed in deployed SHA (`/api/auth/reauth`, layout redirect-only) |
| `verify-shop-admin-oidc-preflight.mjs` | Green against test-shop-admin |
| Shop staging acceptance `seed_catalogue=true` ×2 | [37751185117](https://github.com/LAX-UK/monorepo/actions/runs/37751185117), [37753353611](https://github.com/LAX-UK/monorepo/actions/runs/37753353611) — both fail `first-login.spec.ts` sign-out → sign-in with `sign-in-error?reason=token_exchange_failed` (Shop Identity token exchange; separate from shop-admin staff callback) |
| Hosted auth social (#462) | [lax-identity PR #36](https://github.com/LAX-UK/lax-identity/pull/36) opened; needs approving review → publish → identity deploy |
| Deploy preflight Postgres CA | [#466](https://github.com/LAX-UK/monorepo/pull/466) in merge queue (unblocks future `terraform-apply-test` DB preflights on `main`) |
