# Identity staging extraction — acceptance evidence

Use this record for the D23 switch of `https://test-auth.lax.bid` to the
standalone `LAX-UK/lax-identity` image. Repository CI proves code readiness;
this record proves the staging release. Do not transfer source authority while
any required field is blank or any gate is red.

## Release identity

| Item | Required evidence |
|---|---|
| Monorepo commit | Full SHA and green CI URL |
| Infra commit | Full SHA and reviewed Terraform plan URL |
| Identity commit | Full SHA and green standalone CI URL |
| Identity image | `lax-test-identity:<sha>` plus immutable digest |
| Migration contract | Source `eb16ec8630af125b315637e44b395078bc1dfcea`; `0161_revoke_api_user_reads`; journal `29a4f140fee4cdfb466fead01fc55d494aefb5e534f393bc004d097b542699ea`; pinned test artifact `lax-test-migrate@sha256:fceea8076c999500ab88877d1fe352b9bf3f84920615facab591c4e2eb7511c8` |
| Fallback image | Captured 2026-09-06: `lax-test-auth:c4df7fbb540304192b10f197df480c626c4e9b95` at `sha256:e1ce432eacf1f8e63e932947df9ea1f44115342fd7d20eededce130d3a19223c` <!-- gitleaks:allow — immutable public image identifiers, not credentials --> |
| Sentry | Auth release URL and source-map upload result |
| Supply chain | SBOM and vulnerability-scan artifacts |

## Measured thresholds

Capture at least 24 hours of pre-switch staging data. Engineering and Ops must
write numeric values and approve them before the Terraform apply; “no
regression”, “normal”, and other placeholders are not accepted.

| Signal | Baseline window/value | Green threshold | Rollback threshold |
|---|---|---|---|
| Auth availability | | | |
| Auth 5xx rate | | | |
| Login/refresh failure rate | | | |
| Auth p95 latency | | | |
| Postgres pool saturation | | | |
| Redis error/latency rate | | | |
| Directory processing lag | | `<= 60000ms` | `> 60000ms` |
| Lifecycle outbox oldest pending age | | | |
| Logout/SSF failed delivery rate | | | |

Zero tolerance always applies to security/contract gate failures, directory
drift, invalid role grants, invalid issuer/audience/scope, missing JWKS keys,
unresolved high-severity Sentry regressions, and secret/vulnerability findings
that violate the approved CI policy.

## Pre-switch evidence

Snapshot captured 2026-09-07 from the current monorepo fallback:
issuer `https://test-auth.lax.bid`; JWKS key ID
`e217f112-f694-419e-b59d-1499944bbf08`. The deployed fallback discovery
document does not yet advertise `end_session_endpoint`; this is baseline
evidence, not a passing target-host result.

### Lockfile portability diagnosis

Diagnostic commit `e19e721e79cb699b3654b99d06d608c8f7577dc2` and
[CI run 34146359250](https://github.com/LAX-UK/monorepo/actions/runs/34146359250)
captured the generated closure lock and effective pnpm configuration. The CI
lock and a cold-store local lock were byte-for-byte identical at SHA-256
`a33b4f496a0f44a4f780c556d84c4aa8fc6ea2770956cdc6ee4a10167a435624`.

The failure was configuration inheritance, not nondeterministic resolution.
The CI workflow launches the Node rehearsal through the monorepo pnpm script,
which exported the parent `node-linker=hoisted` as
`npm_config_node_linker=hoisted`. That environment value overrode the
extracted workspace's `node-linker=isolated` and made pnpm 10.34.5 reject the
otherwise valid lock while filtering production dependencies. The captured
workspace reproduced the missing `vitest@3.2.7` lock entry with the inherited
value and passed unchanged after removing it. Identity lock generation and
rehearsal now remove parent workspace-topology pnpm variables before invoking
child pnpm, leaving registry, authentication, proxy, and store configuration
intact.

- [ ] Full monorepo verification and Identity extraction rehearsal green.
- [ ] Filtered Identity history passed full-history Gitleaks.
- [ ] Standalone CI ran every DB integration test; none skipped for missing
      `DATABASE_URL`.
- [ ] Migration lineage matches the pinned schema contract.
- [ ] `db:roles` and live auth/API/Shop/worker role probes green.
- [ ] Full OIDC client registry reviewed and provisioned.
- [ ] `/health/ready` is green with the intended production env contract.
- [ ] Discovery document and public JWKS key IDs captured (no private material).
- [ ] Terraform state backup and reviewed plan recorded.
- [ ] Numeric thresholds above approved.

### Live-gate defects discovered before acceptance

The staging gate is doing real qualification rather than being waived around
failures. Four product or probe defects were found and corrected:

1. Successful sign-ins consumed the issuer's 15-minute failure buckets, causing
   repeated acceptance runs to return 429. Fixed by retaining only failed
   attempts; monorepo
   [PR #348](https://github.com/LAX-UK/monorepo/pull/348) and standalone
   Identity [PR #11](https://github.com/LAX-UK/lax-identity/pull/11).
2. Bid and Shop probes understood only a first-time OIDC consent HTML page.
   After consent was stored, Better Auth returned a JSON redirect envelope.
   Fixed by the shared authorize-response interpreter; monorepo
   [PR #349](https://github.com/LAX-UK/monorepo/pull/349).
3. Auth-at-rest verification treated an expected null `refresh_token_hash` on a
   newly issued, not-yet-refreshed OAuth token as plaintext. The same verifier
   would fail closed at the next Identity startup. Fixed in monorepo
   [PR #350](https://github.com/LAX-UK/monorepo/pull/350) and standalone
   Identity [PR #12](https://github.com/LAX-UK/lax-identity/pull/12).
   Maintenance passed in staging recovery runs
   [34733452065](https://github.com/LAX-UK/monorepo/actions/runs/34733452065)
   and
   [34733828681](https://github.com/LAX-UK/monorepo/actions/runs/34733828681).
4. Better Auth's implicit production limiter independently counted every
   `/sign-in/*` request in per-process memory (three per IP and path per ten
   seconds), on top of the documented Redis failed-attempt policy. In both
   recovery runs above, forged-origin, Bid, Shop, and refresh probes made the
   refresh sign-in the fourth request in that rolling window. The canonical
   fix explicitly disables the built-in limiter and ports its remaining
   sensitive-path coverage into the Redis issuer middleware.
5. After the limiter correction allowed refresh rotation to pass, staging
   recovery run
   [34735858227](https://github.com/LAX-UK/monorepo/actions/runs/34735858227)
   found that RP-initiated logout produced no Bid delivery row. Better Auth
   deletes the OP session before post-response security side effects run, and
   the `ON DELETE SET NULL` foreign key cleared `identity_session_id` before
   the logout repository queried it. The durable RP `sid` intentionally
   retains the same session identifier; revocation now matches either field,
   with a PostgreSQL regression test that reproduces the FK transition.

These runs are diagnostic evidence, not accepted releases: SSF-enabled,
rollback, restore, and soak gates remain required.

## Target-host acceptance

Record command, UTC timestamp, sanitized output artifact, and operator for each:

- [x] Discovery/JWKS HTTPS, issuer, headers, keys, and API retired routes.
- [x] Bid login, callback, host-only session, BFF resource request, exchanged
      `lax-bid-api` audience/scopes, refresh, and negative PKCE.
- [x] Shop cold login, SSO, local session, projection, and logout isolation.
- [x] Machine token issue, introspection, revocation, expiry, and rate limits.
- [x] RFC 8693 valid and invalid audience/scope exchanges.
- [x] Forged-origin/CSRF and browser-cookie-as-Bearer rejection.
- [x] Bid and Shop back-channel logout delivery, retry, and replay.
- [x] SSF verification while disabled; controlled enablement, SET delivery,
      retry, dead-letter, and replay.
- [x] Directory/profile reconciliation has zero drift and pending events.
- [x] Lifecycle outbox/projector lag is within the signed threshold.
- [x] Live auth/API/Shop/worker role contracts are green.
- [x] Metrics/dashboard and Sentry signals are visible for the Identity SHA.

### Post-cutover acceptance bundle (2026-09-13 UTC)

Monorepo `main` at `af0a1e312`; staging migrations through **0161**
(`identity_user_read_cutover head=0161`, `worker_user_select=revoked`,
`api_user_select=revoked`). SSF delivery enabled on staging.

| Gate | Run | Result |
|---|---|---|
| SSF-disabled acceptance (2×) | [34752380423](https://github.com/LAX-UK/monorepo/actions/runs/34752380423), [34752522322](https://github.com/LAX-UK/monorepo/actions/runs/34752522322) | Green |
| SSF enable (Terraform) | [34754667390](https://github.com/LAX-UK/monorepo/actions/runs/34754667390) | Green |
| SSF-enabled acceptance (main) | [34759234863](https://github.com/LAX-UK/monorepo/actions/runs/34759234863) | Green |
| Migration promotion 0160 | [34759745620](https://github.com/LAX-UK/monorepo/actions/runs/34759745620) | Green |
| Migration promotion 0161 | [34760146208](https://github.com/LAX-UK/monorepo/actions/runs/34760146208) | Green |
| SSF-enabled acceptance (post-0161) | [34760340032](https://github.com/LAX-UK/monorepo/actions/runs/34760340032) | Green |

Accepted image contract:

| Component | SHA | Digest |
|---|---|---|
| Identity | `933c947faa922ebb7374db2aea9b09d7ba0b344c` | `sha256:2e23cf9d0b075e7645774ca2f8c229935ae4fa55138a33d1eaa184c2768e35a4` |
| Shop identity | `20a9a335b9f8d6686b52092af06f2f185373ca57` | `sha256:69067e6c02b11564baaba7107dfcc832ff528fa6cbbbb975efb6fd15a776e434` |
| Shop | `20a9a335b9f8d6686b52092af06f2f185373ca57` | `sha256:c3b589069599c65eca718a97cdf94890c788e7db7fe270729faec2176cbd1465` |

## Soak

- Start UTC: **2026-09-13T13:39:52Z** (post-0161 SSF-enabled acceptance green)
- End UTC: pending (minimum 24h; extend to 72h if traffic is insufficient)
- Total observed traffic by login/refresh/token operation:
- [ ] At least 24 hours observed.
- [ ] Extend to 72 hours if traffic is insufficient for the approved sample.
- [ ] Every signed threshold remained green.
- [ ] No unresolved high-severity Sentry regression.
- [ ] Directory and lifecycle reconciliation remained clean.

## Rollback rehearsals

### Previous standalone image

- [ ] Move `lax-test-identity:test` to the recorded previous standalone SHA.
- [ ] Deploy only through the monorepo orchestrator.
- [ ] Repeat readiness, discovery, login, refresh, and resource-token smoke.
- [ ] Restore the candidate digest and repeat smoke.

### Monorepo production fallback

- [ ] Revert the Terraform image repository and Sentry env change together.
- [ ] Deploy the recorded `lax-test-auth:<sha>` without schema changes.
- [ ] Repeat readiness, discovery, login, refresh, and resource-token smoke.
- [ ] Reapply the reviewed standalone Terraform state and repeat smoke.

## Authority transfer

| Role | Name | Date (UTC) | Decision/evidence URL |
|---|---|---|---|
| Engineering | | | |
| Operations | | | |

Source authority transfers only when both signatures are present and every
required checkbox and threshold is green. Otherwise restore the monorepo
fallback and leave source authority unchanged.
