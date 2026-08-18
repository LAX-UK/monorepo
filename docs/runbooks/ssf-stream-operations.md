# SSF stream operations

Identity exposes SSF stream configuration under `https://auth.lax.bid/ssf`.
Streams are provisioned disabled and delivery is globally off while
`SSF_DELIVERY_ENABLED=false`.

## Provision and verify

1. Confirm migrations `0143`–`0146`, role contracts, active RS256 signing key,
   and exact receiver registry are present.
2. Keep `SSF_DELIVERY_ENABLED=false`.
3. Authenticate as the registered confidential receiver and create/read the
   stream at `/ssf/stream`. Creation must report `status=disabled`, exact
   audience and endpoint, push method `urn:ietf:rfc:8935`, and requested events.
4. POST the stream id and an operator-generated state to `/ssf/verification`.
   Verification delivery is allowed while disabled.
5. Confirm the receiver returns 2xx, records the verification SET exactly once,
   preserves the state, and rejects replay of the same `jti`.
6. Set the stream status to `enabled`, then set
   `SSF_DELIVERY_ENABLED=true` on `apps/auth`. Enabling resets the stream
   checkpoint to the current domain-event id; it does not backfill old events.

## Monitor

Watch `auction_auth_ssf_delivery_outcomes_total` by `delivered`,
`retry_scheduled`, and `failed`; auth logs
`ssf_delivery_outcome`/`ssf_delivery_drain_failed`; and database counts/age for
`ssf_delivery` states. Alert on failed rows, oldest pending age beyond the
delivery objective, repeated 4xx, timeouts, signature errors, or receiver replay
errors.

Each attempt has the configured `SSF_DELIVERY_TIMEOUT_MS` (default 5000).
Failures retry exponentially from one second, capped at one hour, until
`SSF_DELIVERY_MAX_ATTEMPTS` (default 8). Exhausted rows remain `failed`; this is
the dead-letter state.

## Retention

Identity runs an overlap-guarded purge every 15 minutes, deleting at most 500
rows from each owned table per pass. Delivered `ssf_delivery` rows are retained
30 days and failed dead letters 90 days; pending/delivering rows are never
age-purged. Bid and Shop independently purge their own expired replay ledgers
every 15 minutes in batches of 500. Replay rows may remain for one schedule
interval after expiry, but expired SETs still fail token validation.

Monitor eligible backlog and terminal-row age:

```sql
select status, count(*) as rows, min(updated_at) as oldest_updated_at
from ssf_delivery
group by status
order by status;

select
  count(*) filter (where status = 'delivered' and updated_at < now() - interval '30 days')
    as delivered_eligible,
  count(*) filter (where status = 'failed' and updated_at < now() - interval '90 days')
    as failed_eligible
from ssf_delivery;

-- Run through each receiver's own database role, never from Identity:
select count(*) as expired_replay_rows, min(expires_at) as oldest_expiry
from bid_ssf_replay
where expires_at < now();

select count(*) as expired_replay_rows, min(expires_at) as oldest_expiry
from shop_ssf_replay
where expires_at < now();
```

Alert if an eligible backlog grows across four consecutive 15-minute passes.
Do not manually purge pending/delivering rows or use a cross-application role
to compensate for a stopped receiver-owned purge.

## Delivery failure

1. Pause the affected stream. Do not disable all streams unless the issuer or
   signing key is suspect.
2. Classify `last_status_code` and `last_error`: DNS/TLS/timeout; 401/403
   issuer/audience/key policy; 400 token/event/time/replay validation; 404 route;
   429/5xx receiver capacity.
3. Fix the receiver and send a new verification event.
4. For failed business SETs, preserve the original signed token, `jti`, and
   source event. Reset only reviewed failed rows to `pending` with
   `attempt_count=0`, `claimed_at=NULL`, and `next_attempt_at=now()`. Do not mint
   replacements or change payloads during replay.
5. Resume the stream and confirm delivery/idempotency before clearing the
   incident.

## Signing-key rotation

SETs are signed with the active RS256 key and record `signing_kid`. Follow the
[JWKS rotation runbook](./jwks-rotation.md). Keep the retiring public key
published for the full retirement window and until all SETs signed by it are
delivered or deliberately dead-lettered. Verification delivery with the new
`kid` must pass before retiring the old key.

## Disable and rollback

To stop one receiver, set its stream `paused` while investigating or `disabled`
to reset its checkpoint on the next enable. To stop all SSF delivery, first
pause streams, then set `SSF_DELIVERY_ENABLED=false`; queued rows remain durable.
Do not delete streams or deliveries as a rollback mechanism.

Schema rollback is last resort: stop auth delivery, prove no required pending
or failed SETs remain, then roll back `0146`, `0145`, `0144`, `0143` in that
order. Back-channel logout is a separate mechanism and should remain operational.
