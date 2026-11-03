# JWKS Key Rotation

Source of truth: D2 in the identity-layer plan.

Retirement window:

```text
max(discovery_cache_ttl, max_access_token_lifetime) + safety_margin
= max(60s, 15min) + 15min
= 30 minutes
```

Procedure (the operational steps are in [../runbooks/jwks-rotation.md](../runbooks/jwks-rotation.md)):

1. `pnpm jwks:rotate` inserts a new `jwks_key` row as `active` and moves the
   previous `active` row to `rotating` with `rotated_at = now()`, in one
   transaction.
2. `/.well-known/jwks.json` publishes every `active` and `rotating` key, so both
   keys are published immediately.
3. Wait one discovery cache TTL (60s).
4. Keep the old key in JWKS for the full 30-minute retirement window.
5. The scheduled retirement in `apps/auth` marks the old key `retired` once
   `rotated_at` is older than the window. `retired` keys are no longer published.
6. Delete retired keys during the next rotation cycle, not immediately.

Incident rotation follows the same flow but starts immediately after secret containment.
