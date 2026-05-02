# JWKS Key Rotation

Source of truth: D2 in the identity-layer plan.

Retirement window:

```text
max(discovery_cache_ttl, max_access_token_lifetime) + safety_margin
= max(60s, 15min) + 15min
= 30 minutes
```

Procedure:

1. Insert a new `jwks_key` row with `status='rotating'`.
2. Publish both current and rotating keys from `/.well-known/jwks.json`.
3. Wait one discovery cache TTL (60s).
4. Mark new key `active`.
5. Keep the old key in JWKS for the full 30-minute retirement window.
6. Mark old key `retired`.
7. Delete retired keys during the next rotation cycle, not immediately.

Incident rotation follows the same flow but starts immediately after secret containment.
