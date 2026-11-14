# Review of #1372 — in progress

Head reviewed: `61630cc5` (base `main` `f1ffc6e4`).

## Progress
- Install + package build: OK. PG 16 throwaway (port 55432): `db:migrate` + `db:roles` OK, 0383 applied, ledger max = 1811246400000 (0383), journal idx 375 follows 0382 (idx 374) on main.
- 0383 checks on PG 16: two raw writers -> second blocks then 23505; two recorder-style writers (advisory lock + exists) -> one row, second skips; first writer rolls back -> second inserts (no lost event); rollback file drops index and ledger row, re-migrate reapplies; duplicate pre-check refuses with its message; behind an open writer the build stops at 5.0 s (lock_timeout).
- (i) prod infra (auction-infra, read-only): api and worker get NODE_ENV=production and APP_ENV=production.
- Pending: (b) intent-match edge case, (h) group sweep, tests, mutation tests.
