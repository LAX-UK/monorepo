
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

**2026-09-13 update:** Steps 1–5 complete on staging. SSF-disabled and SSF-enabled
acceptance green on `main` through migration **0161**; see
[identity-staging-extraction-evidence.md](./identity-staging-extraction-evidence.md)
for run URLs and image contract. Soak window started **2026-09-13T13:39:52Z**.

`IDENTITY_STANDALONE_CUTOVER_COMPLETE` remains **unset** until the acceptance workflow is green and soak is signed.

## Shop commerce staging acceptance (2026-09-22)

Immutable cutover publishes four Shop-related images on test: `shop`, `shop-identity`, `shop-api`, and migrate (see [`staging-recovery-test.yml`](../../.github/workflows/staging-recovery-test.yml) inputs). Pass `shop_image` and `shop_api_image` as `<40-char-sha>@<digest>`; recovery parses them into the Terraform image contract. Commerce migrations apply through the latest shop schema on the target SHA; identity evidence through **0161** is not a substitute for commerce deploy proof.

| Check | Workflow / command |
|---|---|
| Identity + Shop BFF boundary | [`identity-staging-acceptance.yml`](../../.github/workflows/identity-staging-acceptance.yml) |
| Shop release-pinned health + Stripe webhook (`400` on unsigned POST) + fixture-independent browser gates | [`shop-staging-acceptance.yml`](../../.github/workflows/shop-staging-acceptance.yml) with required `shop_sha` |
| Commerce / catalogue Playwright evidence (destructive seed) | Manual [`shop-staging-acceptance.yml`](../../.github/workflows/shop-staging-acceptance.yml) with matching `shop_sha` and `seed_catalogue=true` (destructive on `reed-study` edition ownership). Recovery and rollback rehearsal re-run Shop acceptance after restore with the same `shop_sha`. |

Record run URLs and accepted image digests (including **shop-api**) in [identity-staging-extraction-evidence.md](./identity-staging-extraction-evidence.md) when commerce acceptance completes.

## Staging recovery reruns (acceptance vs full chain)

Use the smallest workflow that can prove the fix:

| Change type | Workflow | Typical duration |
|---|---|---|
| Acceptance probes only (OIDC, role contracts, directory drift, metrics) | [`identity-staging-acceptance.yml`](../../.github/workflows/identity-staging-acceptance.yml) via **workflow_dispatch** with the **already-deployed** `identity_sha`, `ssf_mode`, and `outbox_max_age_ms` | ~3–10 minutes |
| Image publish, Terraform apply, SSF toggle, Shop acceptance, rollback rehearsal | [`staging-recovery-test.yml`](../../.github/workflows/staging-recovery-test.yml) or `scripts/ci/dispatch-identity-final-chain.mjs` with full image pins | ~30–60 minutes |

Acceptance reruns do **not** redeploy Identity or Shop images. Full recovery is required when infra, migrate, or image digests change. Network-bound acceptance probes retry once by default (`IDENTITY_PROBE_RETRY_ATTEMPTS`); contract assertions do not retry. Failed probes are listed together in the acceptance job summary after a `continue-on-error` pass.
