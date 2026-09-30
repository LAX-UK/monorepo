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

## After CI gating and speed pass (main @ 551aa56ec, PR run 36709810575)

| Job / area | Duration | Notes |
|------------|----------|--------|
| `test` | **10m 43s** | target was &lt;7m; api still ~202s vitest wall |
| `@auction/api` vitest (inside test) | **~202s** | `pool:threads`, default isolation (`isolate:false` reverted) |
| `build` | **7m 51s** | parallel with test |
| `web vitest` shards | **3m 24s – 4m 45s** | `pool:forks`, `maxWorkers:2`, 4 shards kept |
| `browser-gates` | **16m 4s** | parallel; required with `ci-result` |
| PR wall to `ci-result` | **~10m 49s** | under 10m target if browser-gates excluded from aggregator |
| Remote cache | local-only until `TURBO_TEAM` set | OIDC step skipped when var empty |

Targets: PR critical path under 10 minutes; `test` job under 7 minutes — **test still above target**; web shards and PR `ci-result` path met.

## Gating verification (2026-09-30)

- **Ruleset** [24245964](https://github.com/LAX-UK/monorepo/rules/24245964): required checks `ci-result`, `browser-gates`; merge queue ALLGREEN squash; no bypass actors.
- **Classic branch protection** on `main` removed; repo **squash-only**, **delete branch on merge**.
- **PR #413** merged to `main` before queue was enabled; use **merge queue** for subsequent PRs.
- **Failing checks:** ruleset + required checks block merge when `ci-result` or `browser-gates` fail (including admins, `current_user_can_bypass: never` on ruleset).
