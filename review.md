Verdict: SHIP

# Review: #1564 Zoho: write the artwork's stock location to Products.LAX_Location (ZI-6 PR4)

Head reviewed: `064b30da` (base `122b816a`). Independent review; the PR branch was not changed.

## What was checked

| Requirement | Result |
|---|---|
| Field API name and type | `LAX_Location` (`apps/worker/src/integrations/zoho/artwork/location/zoho-location-fields.ts:8`), a text field capped at 255 (`:11`). The value is the location name, plus " (retired)" for a retired location, and `null` (an empty field) when no location is recorded. Names are `btrim`med and at most 80 characters (`packages/db/drizzle/0404_artwork_stock_location.sql:22-23`), so the cap is never hit. The field's existence and type in the sandbox could not be checked from here (no Zoho access); the PR says it exists. |
| Own mode, `off`/`dry_run`/`live`, default `off` | OK. `ZOHO_ARTWORK_LOCATION_MODE` defaults to `off` (`apps/worker/src/env.ts:211`). With `off` nothing is built (`create-zoho-artwork-location.ts:33`), the projector is disabled, and the nightly repeatable is removed. Any mode other than `off` needs OAuth (`env.ts:641-651`). `live` counts in `writesToZohoCrm` (`zoho-live-modes.ts:23`), so it gets the org-type requirement, sandbox outside production, and the start-up org check. |
| Never writes Zoho-owned fields | OK. The only field in the update is `{ LAX_Location: value }` (`zoho-location-sync.ts:96-100`). |
| Idempotent (writes only on a difference) | OK. It reads with COQL and sends only the Products whose trimmed value differs (`zoho-location-sync.ts:61-66`). The event carries no value, so the location is re-read under the per-artwork lock, which makes an out-of-order or repeated event harmless. |
| Shared limiter | Yes, in the sense the other Products writers use it: `createZohoCrmBatchStack` → `ZohoCrmGatewayLimiter` (finding 1). |
| Conflicts / staff edits | LAX owns the field. A Zoho edit is overwritten on the next event or by the nightly pass, as the design says (stock-location.md section 5). The roll-out step makes the field read-only in Zoho. Correct for a LAX-owned field. |
| Delivery ledger + dead-letter | OK. It has its own consumer `zoho_artwork_location` through `processZohoProductDeliveries` (retry, then dead-letter). It is labelled in Failed jobs (`apps/api/.../integration-registry.ts:58`) and counted in `ZOHO_PRODUCT_WRITE_CONSUMERS` for sync health. A Product missing in Zoho is fatal; a refused write keeps Zoho's retryability. |
| Grants | `worker_app` gets SELECT only on `artwork_location` / `artwork_location_move` (`packages/db/src/migrate-roles.ts:718-721,825`). The role contract proves there is no INSERT, UPDATE, DELETE or TRUNCATE. |
| Tests | Unit tests for the value, products adapter, sync, writeback, reconcile and env. Also the projector registry contract, the nightly schedule/removal, the reader integration test, role tests, and the catalog. |
| Doc updated | `docs/integrations/zoho.md` has a new section; `docs/design/stock-location.md` and `.env*.example` are updated. |
| SOLID / minimal / no live switch | OK. It reuses the listing's lock, products writer and page walk, and adds a narrow source reader port. Nothing defaults on. |

## Suites run (throwaway Postgres 16 on :55432, migrated + `db:roles` from this branch, `--maxWorkers=2`)

- `apps/worker src/integrations/zoho src/projectors src/workers` + `worker-store-role-contract` + `worker-role-contract` integration: 109 files, 1265 tests passed.
- `packages/persistence zoho-location-source.integration`: 3/3 passed.
- `packages/db migrate-roles / worker-app-role / worker-table-grants`: 121 passed.
- `packages/types src/domain-event-catalog`: 29 passed; `apps/api integration-registry`: 12 passed.
- GitHub CI on the head: all checks succeeded.

## Findings (none blocking)

1. **The limiter is per stack, not one limiter for the whole process.** `apps/worker/src/container/create-zoho-artwork-location.ts:37` builds a new `ZohoCrmGatewayLimiter` (its state is per instance, `zoho-crm-gateway-limiter.ts:31-33`). Location, listing, writeback and CRM each pace themselves at 100 ms with their own circuit breaker, so their combined rate against Zoho's API credits is not capped jointly. Every existing Products writer works the same way, so this is not a regression. Worth a follow-up if the 03:30 location pass and the listing pass ever overlap at scale.
2. **The design doc promises drift reporting that is not built.** `docs/design/stock-location.md:45` says a value edited in Zoho is "reported in Sync health drift". The PR edited this paragraph, but the nightly pass only logs `zoho_location_reconcile_finished` (`zoho-location-reconcile.ts:51`). It writes no Last check or sync-health row (the listing writes `zoho_listing_sync_run`). Either reword the sentence or add the row in a follow-up.
3. **No start-up record of the mode.** Unlike `ZOHO_ARTWORK_LISTING_MODE` (`packages/db/src/schema/zoho-sync-health.ts:13`), the location mode is not shown in LAX Admin sync health. This is a nit.

## Infra env var needed

- Worker: **`ZOHO_ARTWORK_LOCATION_MODE`** (`off` | `dry_run` | `live`, default `off`) in the auction-infra worker task definition. It is not set today, so the feature is off, which is safe.
- Test workflows: like #1562, which did this for the fulfilment mirror, a `TF_VAR_zoho_artwork_location_mode: ${{ vars.ZOHO_ARTWORK_LOCATION_MODE || 'dry_run' }}` line in `.github/workflows/terraform-test-up.yml`, `terraform-apply-test.yml` and `terraform-apply-test-dispatch.yml` (next to `TF_VAR_zoho_artwork_listing_mode`, lines 193/160/129). Add it after the infra variable exists.
- With `live`: `ZOHO_CRM_EXPECTED_ORG_TYPE` (already required by the other live writers).

## Fixes after review

Fixed on `feat/zoho-artwork-location-writeback` in `1c06a58a` (after merging `main`). Docs only; no code or migration.

- **Finding 2 (fixed by rewording).** `docs/design/stock-location.md:44-46` now says a value edited in Zoho is overwritten on the next change or by the nightly drift check, which logs `zoho_location_reconcile_finished`, and that it is not shown in Sync health. A sync-health row was not added: the only existing run table, `zoho_listing_sync_run`, has no kind column and is read as the listing's Last check, so writing location runs into it would mix the two passes; a separate table needs a migration. `docs/integrations/zoho.md:273` says the same for the nightly pass.
- **Finding 3 (left, needs a migration).** `zoho_sync_health` has one column per mode (`listing_mode`, `artwork_sync_mode`); recording `ZOHO_ARTWORK_LOCATION_MODE` needs a new column. Stated in `docs/integrations/zoho.md:273`; follow-up.
- **Finding 1 (no code change).** `docs/integrations/zoho.md:279` now notes that each Products writer (location, listing, Status writeback, CRM) builds its own `ZohoCrmGatewayLimiter` and paces separately, so their combined rate is not capped by one limiter.

Suites (throwaway Postgres 16 on :55432, migrated + `db:roles`, `--maxWorkers=2`): `packages/persistence zoho-location-source.integration` 3/3; `apps/worker src/integrations/zoho src/projectors` 99 files passed (2 skipped as before), 761 tests. `tsc --noEmit` (worker) clean; biome does not process the Markdown files changed.

## Final recheck

Head `1c06a58a` (contains `main` at `6f2c0de8`). PR branch not changed.

- **`docs/design/stock-location.md` matches what is built.** Section 5 now says a value edited in Zoho is overwritten on the next change or by the nightly drift check. That check only logs `zoho_location_reconcile_finished` (`zoho-location-reconcile.ts`), and the doc says it is not shown in Sync health. This is true: the location pass writes no Sync health row. It also links to the zoho.md section. The field is built as text (`zoho-location-fields.ts:4-11`), which the doc allows ("or text").
- **Sync-health row:** none was added, so no table was reused wrongly and no migration was needed. The PR diff has no `packages/db/drizzle/` file. The reasons recorded (`zoho_listing_sync_run` has no kind column; a mode column needs a migration) are correct, and both are listed as follow-ups in `zoho.md:273`.
- **Per-writer pacing:** `zoho.md` Guards now notes this. It matches the code: `createZohoCrmBatchStack` / `createZohoCrmGateway` each build a new `ZohoCrmGatewayLimiter` (`create-zoho-crm-gateway.ts:14`), called separately for location, listing and CRM.
- **Suites** (throwaway Postgres 16 on :55432, migrated + probes + `db:roles`, `--maxWorkers=2`):
  - `persistence zoho-location-source.integration`: 3/3.
  - `worker src/integrations/zoho src/projectors src/workers` + `worker-role-contract` + `worker-store-role-contract`: 110 files, 1277/1277.
  - `db migrate-roles / worker-app-role / worker-table-grants`: 121/121.
  - `types domain-event-catalog`: 29/29.
  - worker `tsc --noEmit` is clean.
- **PR body:** has no "Generated by/with" line.
- No regressions or new defects found. The fix is docs only.
