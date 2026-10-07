# Shop audit findings (2026-10-07)

| Severity | Finding | Repro | Fix |
| --- | --- | --- | --- |
| Blocker | #461 staff layout mutates cookies in a Server Component (Next 15 throws on every staff page) | Deploy shop-admin at `c16e90eb7` without fix | **Fixed in repo:** `/api/auth/reauth` route + layout redirect-only; map 403 `STAFF_REQUIRED` / `STEP_UP_REQUIRED` |
| Blocker | Test auth release `cb38505b` lacks `lax-shop-admin` in compiled OIDC registry → `invalid_client` on staff sign-in | Authorize with `client_id=lax-shop-admin` on test-auth | **Fixed on test** via staging recovery [37685342028](https://github.com/LAX-UK/monorepo/actions/runs/37685342028); auth release `23b6e0b93` |
| Blocker | Identity staging deploy never cut traffic after publish (`STAGE_ONLY=true` auto-dispatch) | Compare test-auth `/health/ready` release to lax-identity main | **Fixed** — Terraform cutover in staging recovery above |
| Blocker | lax-identity `23b6e0b9` App Platform deploy failed until auth-at-rest backfill | Staging recovery [37682640228](https://github.com/LAX-UK/monorepo/actions/runs/37682640210) auth container exit; inventory showed `twoFactor` pending | Auth at-rest maintenance `apply` [37685152055](https://github.com/LAX-UK/monorepo/actions/runs/37685152055) before retry |
| Blocker | `staging-recovery-test.yml` `startup_failure` (no jobs) | `gh workflow run` before Oct 2026 fix | Grant `actions: write` on jobs calling `terraform-apply-test.yml` ([#464](https://github.com/LAX-UK/monorepo/pull/464)) |
| High | Shop-admin `returnTo` open redirect via callback | `returnTo=https://evil.example` after login | `safeReturnTo` in login + callback (this PR) |
| High | Tier-1 smoke skipped all shop-admin staff specs (`seed_catalogue=false`) while auth client drift went undetected | shop-immutable-smoke green with broken shop-admin OIDC | OIDC preflight script + tier-1 step (this PR) |
| Medium | PR e2e OIDC registry omitted `lax-shop-admin` | `e2e-pr` configure-oidc only registers bid-web + shop-web | Register client + CI secret in `e2e-pr.yml` (this PR) |
| Medium | Shop-admin UX required extra click on `/login`; stale session dropped `returnTo` | Visit `/orders` unsigned → `/login` card | Middleware → `/api/auth/login`; layout re-auth with path (this PR) |
| Medium | Storefront `/account` guest card instead of immediate sign-in | Guest opens `/account` | Redirect to Shop Identity login (this PR) |
| Low | Hosted auth social buttons text-only; sign-up lacked social; OAuth `?error=` silent | Cancel Google sign-in on hosted login | Provider marks + shared `bindSocialSignIn` + `socialErrorMessage` (this PR; ships via lax-identity release) |
| Deferred | Two consecutive seeded acceptance runs on test | Dispatch shop staging acceptance `seed_catalogue=true` ×2 after auth fix | Track in CI after merge + auth redeploy |

Blockers marked fixed in-repo still require **Identity staging deploy** on test before staff sign-in is verified live.
