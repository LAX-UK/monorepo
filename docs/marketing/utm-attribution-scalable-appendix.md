# UTM attribution — scalable appendix (deferred)

This document describes the **full** attribution architecture we intentionally deferred in favour of the [lean snapshot](./utm-attribution.md). Adopt only if reporting must move in-house and become independent of GA4 (cross-device multi-touch, custom lookback, warehouse export).

## Append-only touchpoint stream

- Table `marketing_touchpoint`: one immutable row per campaign landing (`user_id` and/or `anon_id`, `captured_at`, campaign fields, landing path, consent basis).
- First / last / multi-touch models derived in SQL or dbt (linear, position-based, time-decay).
- Lean `marketing_attribution` becomes a **read-model projection** over the stream.

## Identity stitching

- Pre-login touchpoints keyed by anonymous id; on auth, fold into user id (first-touch immutable).
- Highest complexity: cross-device merges, GDPR deletion of anonymous rows.

## Upgrade path from lean snapshot

1. Add `marketing_touchpoint` (additive migration).
2. Dual-write touchpoints behind a new flag while continuing snapshot updates.
3. Switch snapshot derivation to read from the stream (no API contract change).
4. Optional warehouse export for modelling.

No rewrite of publisher mappings or `PUT /marketing/attribution` contract is required.
