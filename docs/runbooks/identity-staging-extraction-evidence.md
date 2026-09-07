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
| Migration contract | `c4df7fbb540304192b10f197df480c626c4e9b95`; `0161_revoke_api_user_reads`; journal `29a4f140fee4cdfb466fead01fc55d494aefb5e534f393bc004d097b542699ea`; `lax-test-migrate@sha256:fceea8076c999500ab88877d1fe352b9bf3f84920615facab591c4e2eb7511c8` |
| Fallback image | Captured 2026-09-06: `lax-test-auth:c4df7fbb540304192b10f197df480c626c4e9b95` at `sha256:e1ce432eacf1f8e63e932947df9ea1f44115342fd7d20eededce130d3a19223c` |
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

## Target-host acceptance

Record command, UTC timestamp, sanitized output artifact, and operator for each:

- [ ] Discovery/JWKS HTTPS, issuer, headers, keys, and API retired routes.
- [ ] Bid login, callback, host-only session, BFF resource request, exchanged
      `lax-bid-api` audience/scopes, refresh, and negative PKCE.
- [ ] Shop cold login, SSO, local session, projection, and logout isolation.
- [ ] Machine token issue, introspection, revocation, expiry, and rate limits.
- [ ] RFC 8693 valid and invalid audience/scope exchanges.
- [ ] Forged-origin/CSRF and browser-cookie-as-Bearer rejection.
- [ ] Bid and Shop back-channel logout delivery, retry, and replay.
- [ ] SSF verification while disabled; controlled enablement, SET delivery,
      retry, dead-letter, and replay.
- [ ] Directory/profile reconciliation has zero drift and pending events.
- [ ] Lifecycle outbox/projector lag is within the signed threshold.
- [ ] Live auth/API/Shop/worker role contracts are green.
- [ ] Metrics/dashboard and Sentry signals are visible for the Identity SHA.

## Soak

- Start UTC:
- End UTC:
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
