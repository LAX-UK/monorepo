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

## After CI gating and speed pass (PR #413, run 36706173368 @ de66a9588)

| Job / area | Duration | Notes |
|------------|----------|--------|
| `test` | ~8–9 min (api threads-only pilot) | api `isolate:false` reverted; threads kept |
| `web vitest` shards | ~4–5 min each | CI uses `pool:forks`, `maxWorkers:2` (threads hung Radix popover tests) |
| Remote cache | local-only until `TURBO_TEAM` set | OIDC step gated when var empty |

Targets: PR critical path under 10 minutes; `test` job under 7 minutes.
