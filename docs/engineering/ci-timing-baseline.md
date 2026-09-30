# CI timing baseline

Record wall-clock from GitHub Actions job summaries. Update after each major pipeline change.

## Before CI gating and speed pass (main @ 9daa9632, run 36701951622)

| Job / area | Duration | Notes |
|------------|----------|--------|
| `test` | ~12 min | Critical path |
| `@auction/api` vitest (inside test) | 238s | collect/transform dominated |
| `@auction/auth-app` vitest | 121s | serial DB |
| `@auction/db` vitest | 89s | |
| `web vitest` (4 shards) | 4–8 min each | serial jsdom, 197 files/shard |
| Per-job `.turbo` GHA cache | low hit rate | separate keys per job |

## After CI gating and speed pass (fill from first green PR)

| Job / area | Duration | Notes |
|------------|----------|--------|
| `test` | | target under 7 min |
| `web vitest` shards | | target under 4 min each |
| Remote cache | | second run on same SHA should show turbo cache hits |

Targets: PR critical path under 10 minutes; `test` job under 7 minutes.
