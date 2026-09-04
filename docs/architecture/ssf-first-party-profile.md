# LAX first-party SSF/CAEP profile

This is a deliberately bounded first-party profile of OpenID Shared Signals
Framework 1.0 Final. It is not a claim of general SSF, CAEP, or RISC
conformance.

## Protocol boundary

- Identity is the transmitter at `https://auth.lax.bid`.
- Only RFC 8935 push delivery is supported. Poll delivery, dynamic receiver
  registration, subject-management endpoints, encryption, and third-party
  receivers are out of scope.
- Management endpoints accept HTTP Basic client authentication for the two
  registered confidential LAX clients. A stream endpoint must exactly match
  the receiver registry in `packages/identity-contracts/src/ssf.ts`; arbitrary
  URLs are never fetched. HTTP localhost endpoints are accepted only outside
  production.
- Streams are provisioned disabled. `SSF_DELIVERY_ENABLED=true` is an explicit
  rollout switch, not a dynamic-registration switch.
- SETs use the active Identity RS256 key and `typ=secevent+jwt`. They contain
  one event, an opaque `sub_id`, `iss`, `aud`, `iat`, `jti`, and the source
  domain-event correlation ID as `txn`. They do not contain email addresses,
  credentials, access tokens, or refresh tokens.

Supported standard signals are CAEP `session-revoked` and
`credential-change`, plus RISC `account-disabled`, `account-enabled`, and
`account-purged` when a real permanent-deletion event exists. No assurance
signal is emitted because the current Identity domain model has no durable
assurance-change evidence. Account merge uses the explicitly private
`https://schemas.lax.bid/secevent/identity/event-type/account-merged`
extension because RISC 1.0 has no merge event and treating a merge as
`account-purged` would discard the canonical-subject association.

## Delivery and transition

`domain_events` remains the source outbox. `ssf_delivery` associates each
source event and subscribed stream with one immutable signed SET; it does not
advance or mutate existing worker projector state. Delivery is after commit,
uses bounded batches, `SKIP LOCKED`, stale-claim recovery, timeouts, no
redirects, exponential retry, and terminal failure state.

Bid and Shop receivers verify the SET before atomically reserving its JTI and
applying convergent local updates. Existing worker projectors remain enabled
during the shared-database transition; cutover requires separate operational
evidence and is not part of this phase.

OpenID Connect Back-Channel Logout remains the RP browser-session logout
mechanism. SSF transports broader security and account-state signals and does
not replace or duplicate logout-token delivery.
