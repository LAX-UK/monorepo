# Postgres backup and point-in-time restore

DigitalOcean Managed Postgres provides automated backups and point-in-time recovery (PITR). This runbook covers restoring to a **throwaway** database for drill evidence and emergency recovery.

## Symptom

- You need to prove RTO/RPO, rehearse recovery before a campaign, or recover from operator error / corruption after backups exist.

## Diagnosis

1. In DigitalOcean control panel → **Databases** → select `lax-prod-postgres` (or test cluster).
2. Open **Backups & restore** (or **Settings** → backups). Note:
   - Latest full backup timestamp.
   - Whether PITR is enabled (required for sub-hour recovery targets).

## Resolution — fork / restore to a new cluster (recommended drill)

1. **Maintenance window:** announce if any monitoring will fire on duplicate traffic; drills should use a **new** cluster name so production DNS is unchanged.
2. **Create restored cluster:** DO UI → **Fork** / **Restore from backup** → choose **Point in time** or latest backup → new cluster in same region (`lon1`), smallest viable size for validation (`db-s-1vcpu-1gb`).
3. Record **T0** = click time, **T1** = cluster status **Online** (control panel).
4. From a secure jump host (or CI job with `psql`), connect with the **restored** connection string (use `doadmin` URI from the new cluster):

```bash
psql "$RESTORED_DATABASE_URL" -c "SELECT 1 AS ok, now() AS server_time;"
```

5. Record **T2** = first successful read. Run migration sanity (read-only):

```bash
export DATABASE_URL="$RESTORED_DATABASE_URL"
pnpm --filter @auction/db exec drizzle-kit check  # or project’s documented check
```

6. Optional: run `pnpm --filter @auction/db db:migrate` **only** if you intend this fork to match app schema at head — normally **skip** for a read-only drill.

7. **Tear down** the throwaway cluster when finished to avoid cost.

## Resolution — logical dump to local Docker (cheap RTO lower bound)

Useful when DO API/UI is unavailable or for developer rehearsal.

```bash
# Source: any reachable Postgres (CI, snapshot VPN, etc.)
time pg_dump --no-owner --format=custom -f /tmp/auction.dump "$SOURCE_DATABASE_URL"

docker run --rm -e PGPASSWORD=postgres -p 55432:5432 -d --name pg-restore-test postgres:16-alpine
until docker exec pg-restore-test pg_isready -U postgres; do sleep 1; done
time pg_restore --no-owner -h localhost -p 55432 -U postgres -d postgres --create /tmp/auction.dump
```

Then connect to `postgresql://postgres:postgres@localhost:55432/<dbname_from_dump>` and run `SELECT 1`.

## Escalation

- If restore fails repeatedly: open DO support ticket with cluster UUID and backup ID.
- If corruption is suspected **in production**: stop writes (maintenance page + pause workers), **do not** delete the primary cluster until a fork succeeds.

## Observed RTO (fill on each drill)

| Drill date | Environment | Snapshot / PITR point | T0→Online (T1−T0) | T0→first SELECT (T2−T0) | Notes |
|------------|---------------|---------------------|-------------------|-------------------------|-------|
| _YYYY-MM-DD_ | DO fork → throwaway | _as chosen_ | _e.g. 12 min_ | _e.g. 14 min_ | _operator initials_ |
| _YYYY-MM-DD_ | `pg_dump` → local Docker | N/A | _container start ~30s_ | _restore wall time X min_ | _local dev drill_ |

**Target:** document actual numbers here after the first production-region drill; update this table each quarter.

## RPO expectation

- Managed Postgres continuous archiving typically allows **minutes** of RPO when PITR is enabled; confirm in DO UI for the subscription tier.
- Logical `pg_dump` RPO equals **dump start time** — usually hours unless dumps are continuous (not the default).

## Related

- [Migration rollback](./migration-rollback.md) — schema rollback is not a substitute for restore.
- [State recovery](./state-recovery.md) — Terraform state, not database.
