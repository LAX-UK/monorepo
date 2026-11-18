Verdict: SHIP

# Review: #1561 Zoho: document canary, artwork badge reads the listing consumer, print master doc

Head reviewed: `5f63cb0a` (base `122b816a`). Independent review; the PR branch was not changed.

## 1. Canary documentation matches the code

Checked every use of `ZOHO_CRM_SYNC_MODE` in the repository. Only the worker reads it.
- `resolveZohoDeliveryMode` returns `canary` or `live` for allowlisted types (`apps/worker/src/integrations/zoho/zoho-crm-config.ts:51-58`). The projector branches only on `off`, `disabled_type` and `dry_run` (`apps/worker/src/projectors/zoho-projector.ts:41,48`).
- The held-deal release sweep runs in both modes (`zoho-projector.ts:152`). `writesToZohoCrm` treats them alike (`zoho-live-modes.ts:19-20`). Backfill writes in both (`backfill-crm-users.ts:77,154`). `reconcile-crm-links.ts` only refuses `off`.
- The canary event list is the same allowlist (`ZOHO_CRM_ENABLED_EVENT_TYPES`) in both modes. The always-on GDPR lifecycle and erasure-follows-sync rules (`zoho-crm-config.ts:6-21`) do not depend on the mode.
- The new "Canary is live" section (`docs/integrations/zoho.md:53`), the env table row, and the comments in `env.ts` / `zoho-live-modes.ts` are accurate. The new `zoho-live-modes.test.ts` pins this.

## 2. Artwork "Mirrored to Zoho" badge reads the listing consumer

- **Right consumer and events:** the reader adds `zoho_artwork_listing` deliveries for `artwork_register.offer_changed` on the register entry and for `shop.artwork.created|updated` on the lax.art listing tied by `offer_ref_kind = shop_artwork` or `lax_art_draft_created`. These are the same links the worker uses (`packages/persistence/src/repositories/artwork-register/drizzle-zoho-listing.ts:166-186`). The listing consumer's registry entries agree with this. Lot and sale fan-out is excluded and documented, because `shop_app` has no grant on `lot`.
- **Right state:** `derive-zoho-mirror-state.ts:84-101` treats the listing as its own part. The listing's in-sync and newer-in-Zoho skips count as good, its dry run reads as a dry run, and its `Products:N` reference is never shown as the record id. Skip reasons now come from `@auction/types` (`ARTWORK_LISTING_SKIP`) on both sides, and the contract test enforces them.
- **UI states / kit:** no UI file changed; the badge copy and states are unchanged. The existing components already cover:
  - loading: `Skeleton` (`apps/shop-admin/src/components/zoho/zoho-mirror-column.client.tsx:62`);
  - empty and read-error: no badge, shown as the table's "None" dash (`:84-86`), and `from-zoho-record.client.tsx:61,197` renders nothing when the read fails;
  - failed, mirrored, pending, dry_run, and not_applicable (off): `StatusDetailsButton`, `StatusBadge`, `CopyButton` and `TextLink` from `@auction/staff-ui`.

  There is no new design.
- `shop_app` already reads every table queried; no migration and no grant change.

## 3. Print master documentation matches the code

- `print-group-mirror.ts:103-136` upserts `Print_Products` and `Edition_Ledgers` and issues the `LAX-PRT` register row. The fields listed in the doc match `plan-print-group.ts:4-25` exactly.
- "Fields LAX has no value for are left alone" is true. `differingFields` skips nulls, and `upsertPrintProduct` drops a null `Edition_Type` or `Linked_Original_Artwork` (`zoho-print-modules.ts:120-126`).
- `Print_SKUs` is keyed on `SKU` in the order mirror. `print_group_not_a_product` exists (`artwork/status/zoho-status-sync.ts:180`).
- The "Owner decision pending" wording is appropriate: behaviour is unchanged and the earlier wrong claim is removed.

## Suites run (throwaway Postgres 16 on :55432, migrated + `db:roles`, `--maxWorkers=2`)

- `packages/persistence zoho-mirror-ledger.integration.test.ts`: 10/10 passed (ran against the database).
- `apps/shop-api zoho-mirror` (derive, status service, routes, integration, badge seed): 5 files, 77 tests passed.
- `apps/worker src/integrations/zoho` (including `zoho-live-modes.test.ts`, the listing tests and the skip-reason contract): 59 files, 533 tests passed.
- GitHub CI on the head: `ci-result`, `test` and `worker-role-contract` all succeeded.

## Findings (none blocking)

1. **The failed state reports the writeback's mode, not the listing's.** `apps/shop-api/src/application/zoho-mirror/derive-zoho-mirror-state.ts:215` uses `mode: context.mode`, which is `ZOHO_ARTWORK_WRITEBACK_MODE`. With the writeback `off` and the listing `live`, a dead-lettered listing reads `failed` with `mode: off`, and an unfinished listing reads "mirroring off". Documented as a known edge case. Passing the listing mode into the context would fix both.
2. **One failure is shown on every record a lax.art listing ties to.** `packages/persistence/src/repositories/zoho-mirror/drizzle-zoho-mirror-ledger.reader.ts:118-122` fans a listing delivery out to each record drafted into it. A dead letter caused by one record shows `failed` on the others too. This is the honest reading of a shared delivery; noted only.
3. **The read uses today's offer link.** `drizzle-zoho-mirror-ledger.reader.ts:132-142`. Once an artwork's `offer_ref_id` moves off a lax.art listing it was not drafted into, earlier listing deliveries for that listing, including a standing failure, drop out of its badge. Failed jobs still has them. This is an edge case and a nit.
4. **Nit:** a stray double blank line after the "Canary is live" paragraph (`docs/integrations/zoho.md:56-57`).
