
## Shop staging cutover evidence (2026-09-11)

Implementation commits:

| Repository | Commit | Notes |
|---|---|---|
| LAX-UK/monorepo | `aad7b4707e997828e534a291d33b19c0b7a79df5` | Shop contract seams, hosted Identity UI, `apps/shop`, layer guardrails, workflows |
| LAX-UK/monorepo | `079b9f0fe77ae5cad6b5a2f79ede503889cd5bdc` | Staging Cloudflare gate no longer requires `lax.art` |
| LAX-UK/auction-infra | `b484c8d` on `feat/identity-staging-routing` | `test-shop.lax.bid` DNS + ephemeral Shop component env |
| LAX-UK/lax-identity | `a702f51` on `fix/schema-contract-migrate-digest` | Mirrored contracts + hosted pages; PR [#4](https://github.com/LAX-UK/lax-identity/pull/4) awaiting merge |

Workflow runs attempted:

| Step | Run | Result |
|---|---|---|
| Persistent Terraform apply | [34551278941](https://github.com/LAX-UK/monorepo/actions/runs/34551278941) | **Green** — `test-shop.lax.bid` CNAME on `lax.bid` |
| Ephemeral Terraform apply | [34552215261](https://github.com/LAX-UK/monorepo/actions/runs/34552215261) | **Red** — `postgresql_role.app["shop_app"]` already exists (state drift) |
| Identity staging deploy (`stage_only=false`) | [34552372857](https://github.com/LAX-UK/monorepo/actions/runs/34552372857) | **Red** — App Platform deployment phase `ERROR` after migrate/OIDC registry step succeeded |

Residual ops blockers before full acceptance:

1. Merge [auction-infra#2](https://github.com/LAX-UK/auction-infra/pull/2) (or keep using `infra_ref=feat/identity-staging-routing`).
2. Import or reconcile `shop_app` in ephemeral Terraform state, then re-run ephemeral apply with approved image contracts.
3. Merge [lax-identity#4](https://github.com/LAX-UK/lax-identity/pull/4), publish a new Identity image, redeploy with `stage_only=false`.
4. Re-run `identity-staging-acceptance.yml` against live staging and record 24h soak here.

`IDENTITY_STANDALONE_CUTOVER_COMPLETE` remains **unset** until the acceptance workflow is green and soak is signed.
