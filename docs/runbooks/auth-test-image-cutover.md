# Test Auth image cutover (`lax-test-auth`)

Use this runbook once when moving test Auth from `lax-test-identity` to monorepo
`lax-test-auth` images.

## Before cutover

1. Record live evidence: `curl -sS https://test-auth.lax.bid/health/ready`, active
   App Platform deployment ID (`doctl apps get $DO_TEST_APP_ID`), and the current
   `lax-test-identity` digest from DOCR.
2. Merge [auction-infra #32](https://github.com/LAX-UK/auction-infra/pull/32)
   (`feat/test-auth-monorepo-image`) so test Auth uses `lax-test-auth`.
   **Status check:** `gh pr view 32 --repo LAX-UK/auction-infra` (must be `MERGED`
   before monorepo PR3).
3. Run **Terraform apply test** (ephemeral) after merge; live image tags are
   hydrated via `scripts/ci/resolve-live-app-image-tags.mjs`.
4. Run **App deploy test** with `rollback_rehearsal=true` once; confirm rollback
   reaches `ACTIVE` and readiness passes.
5. Merge monorepo PR2 (`chore/pipeline-pr2-deploy`) then, after the rehearsal
   above, PR3 (`chore/pipeline-pr3-auth-activate`) on `main`.

## Cutover deploy

1. Run **App deploy test** with `git_sha` set to the merge commit (or let `main`
   push deploy). Confirm `build-images` publishes `lax-test-auth:<sha>`.
2. Verify:
   - `https://test-auth.lax.bid/health/ready` reports the monorepo SHA
   - OIDC discovery and JWKS respond
   - App deploy smoke passes Bid and Shop OIDC round trips when `auth` is affected
3. Optional: re-run with `rollback_rehearsal=true`, then redeploy forward.

## After cutover

- Archive `LAX-UK/lax-identity`, revoke its dispatch token, and remove obsolete
  GitHub variables/secrets documented in the pipeline plan.
- Broad acceptance: **Staging acceptance (scheduled)** and manual
  **Identity staging acceptance**.
