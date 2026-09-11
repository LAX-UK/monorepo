
## Shop staging cutover evidence (2026-09-11)

Implementation commits:

| Repository | Commit | Notes |
|---|---|---|
| LAX-UK/monorepo | `48c32b9381582d66abe3eec267399ea6fc14737b` | Recovery gates: boundary scan, hosted verify/resend, Shop Dockerfile, workflow hardening, identity-db lockfile |
| LAX-UK/auction-infra | `9095083` on `feat/identity-staging-routing` | Rebased on main; `shop_app` import; Shop catch-all + shop-identity path routes |
| LAX-UK/lax-identity | `d9cc427` on `fix/schema-contract-migrate-digest` | Mirrored hosted pages, drizzle-orm runtime dep, image import smoke; PR [#4](https://github.com/LAX-UK/lax-identity/pull/4) awaiting merge |

Workflow runs attempted:

| Step | Run | Result |
|---|---|---|
| Persistent Terraform apply | [34551278941](https://github.com/LAX-UK/monorepo/actions/runs/34551278941) | **Green** — `test-shop.lax.bid` CNAME on `lax.bid` |
| Ephemeral Terraform apply | [34552215261](https://github.com/LAX-UK/monorepo/actions/runs/34552215261) | **Red** — `postgresql_role.app["shop_app"]` already exists (state drift) |
| Identity staging deploy (`stage_only=false`) | [34552372857](https://github.com/LAX-UK/monorepo/actions/runs/34552372857) | **Red** — App Platform deployment phase `ERROR` after migrate/OIDC registry step succeeded |

Residual ops blockers before full acceptance:

1. Merge [auction-infra#2](https://github.com/LAX-UK/auction-infra/pull/2) with rebased `9095083` and obtain a reviewed zero-destructive Terraform plan (includes `shop_app` import).
2. Configure `IDENTITY_ACCEPTANCE_EMAIL` and `IDENTITY_ACCEPTANCE_PASSWORD` on the GitHub `test` environment.
3. Merge [lax-identity#4](https://github.com/LAX-UK/lax-identity/pull/4), publish Identity + Shop Identity + Shop images, then run ephemeral apply with all three image contracts.
4. Run Identity deploy with `stage_only=true`, then `stage_only=false` only after readiness gates pass.
5. Run `identity-staging-acceptance.yml` in `ssf_disabled` mode, enable SSF delivery, then rerun in `ssf_enabled` mode; record 24h soak here.

`IDENTITY_STANDALONE_CUTOVER_COMPLETE` remains **unset** until the acceptance workflow is green and soak is signed.
