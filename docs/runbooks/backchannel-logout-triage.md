# Back-channel logout delivery triage

Use this when an RP remains signed in after Identity revokes a session or
subject. Back-channel logout is independent of SSF.

## Establish scope

1. Identify client, subject, Identity session, RP `sid`, revocation time, and
   receiver endpoint.
2. Confirm `oidc_rp_session` contains the client/`sid`, is marked revoked, and
   the client has the exact registered `backchannel_logout_uri`.
3. Find `oidc_backchannel_logout_delivery` by `event_key=client_id:sid`.
   Absence means session registration, client configuration, or revocation
   enqueue failed. A row in `pending`, `delivering`, or `failed` is a delivery
   incident; `delivered` with an active RP session is a receiver incident.

## Classify delivery

- Network/TLS/timeout: verify DNS, certificate, route reachability, and the
  five-second receiver budget.
- 404/405/415: verify exact path, POST, and
  `application/x-www-form-urlencoded` with one `logout_token`.
- 400: inspect receiver logs for signature, `typ`, issuer, client audience,
  `iat`, `jti`, event, nonce, `sid`/`sub`, or replay rejection.
- 401/403: the receiver is applying an authentication control not present in the
  OIDC Back-Channel Logout contract.
- 429/5xx: restore receiver capacity; delivery retries automatically.
- 2xx but session survives: verify durable JTI reservation and invalidation by
  Identity `sid` or subject, then check that the browser cookie points to the
  invalidated local session.

Identity delivers four at a time, times out after five seconds, and tries eight
times with backoff from 15 seconds to one hour. A stuck `delivering` claim is
returned to pending after 60 seconds.

## Retention

Identity's overlap-guarded purge runs every 15 minutes with a 500-row limit per
table. Revoked RP sessions are retained 30 days after revocation; inactive,
unrevoked RP sessions are retained 30 days after last use. Delivered logout
rows are retained 30 days and failed dead letters 90 days. Pending/delivering
deliveries are never age-purged.

Shop separately retains expired `shop_identity_session` rows for seven days,
then purges them in 500-row batches. Its logout replay ledger is purged after
token expiry. Identity must not purge either Shop-owned table.

```sql
select status, count(*) as rows, min(updated_at) as oldest_updated_at
from oidc_backchannel_logout_delivery
group by status
order by status;

select
  count(*) filter (where status = 'delivered' and updated_at < now() - interval '30 days')
    as delivered_eligible,
  count(*) filter (where status = 'failed' and updated_at < now() - interval '90 days')
    as failed_eligible
from oidc_backchannel_logout_delivery;

select
  count(*) filter (
    where revoked_at is not null and revoked_at < now() - interval '30 days'
  ) as revoked_eligible,
  count(*) filter (
    where revoked_at is null and last_seen_at < now() - interval '30 days'
  ) as inactive_eligible
from oidc_rp_session;

-- Run with the Shop-local role:
select
  count(*) filter (where expires_at < now() - interval '7 days') as session_eligible
from shop_identity_session;
```

Alert if eligible rows continue growing across four consecutive purge passes.
Investigate the owning process and role grants rather than deleting across an
application ownership boundary.

## Recover

Fix and verify the receiver first. For an exhausted row, preserve its
`token_jti`, `token_iat`, endpoint, client, subject, and `sid`; reset only the
reviewed row to `pending`, clear `claimed_at`, and set `next_attempt_at=now()`.
The stable event key prevents duplicate enqueue and the receiver must make the
same `jti` harmless.

If immediate containment is required, invalidate the RP's local session
directly through that product's operational boundary, then continue delivery
repair so future revocations work. Do not enable SSF as a substitute for logout.

## Close

- [ ] Delivery row is `delivered` or has an explicitly accepted dead-letter disposition.
- [ ] Target local session is invalid and cookie reuse cannot restore it.
- [ ] Replay of the logout token produces no duplicate side effect.
- [ ] RP-initiated logout and subject-wide logout both pass in the affected environment.
- [ ] Metrics, receiver logs, and incident timeline include client, `sid`, `jti`, attempts, and final outcome without token contents.
