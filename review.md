Verdict: SHIP

# Review: #1567 CRM: sync Shop refunds and fulfilment milestones to the order deal

Head reviewed: `38cb08f0` (base `122b816a`). Independent review; the PR branch was not changed.

## What was checked

| Requirement | Result |
|---|---|
| Events flow only when `ZOHO_CRM_SYNC_MODE` allows them | OK. Both types go through `resolveZohoDeliveryMode` (`apps/worker/src/integrations/zoho/zoho-crm-config.ts:51`): `off` gives `sync_mode_off`, a type not in the allowlist gives `event_type_disabled`, and `dry_run` logs the redacted payload. |
| Canary allowlist respected; nothing added to it silently | OK. `ZOHO_CRM_ENABLED_EVENT_TYPES` still defaults to `""` (`apps/worker/src/env.ts:273`). `.env*.example`, the Terraform workflows and `ERASURE_FOLLOWS_SYNC` / `ZOHO_CRM_ALWAYS_ON_WHEN_PERSON_SYNC_EVENT_TYPES` are unchanged. The registry change (`packages/types/src/domain-event-catalog/registry.ts:1337,1384`) only adds `zoho` to the consumer lists. The result is extra `skipped` rows until an owner lists the types. |
| Idempotent | OK. The stage update is a plain `Stage` PUT, so a repeat writes the same value. The note is keyed `fulfilment:<id>:<status>` in `crm_record_link`, and a redelivery returns the recorded note (`apps/worker/src/integrations/crm/handlers/crm-deal-sync-handler.ts:183-193`). The integration test proves this against the real table as `worker_app`. |
| Out-of-order / repeated events | Mostly OK. A refund before a fulfilment is safe because notes never touch the stage. A repeated webhook adds no duplicate (see above). Two gaps are listed under findings 1 and 2. |
| Money in integer pence | Not applicable. Neither intent sends an amount: the refund changes `Stage` only and the note has no figures. No pence formatting path was added, so none can be wrong. |
| No personal data beyond the deal | OK. The note text is just the milestone ("Shop order fulfilment: Dispatched"). The refund payload's PII flag (`contains_pii`) is irrelevant, since only `orderId` and `status` are read. Erasure already deletes the subject's `note` rows (`crm-subject-lifecycle-handler.ts:152-158`), and the new rows carry `subjectId`. |
| No stage moved backwards | OK for this PR. Refunded is the terminal stage, and fulfilment notes do not move the stage. |
| Deletion guard / held deal / missing link | OK. Same order as `updateDealStage`. |
| Tests | 11 service tests, 4 mapper tests, catalog assertions, and one role-level integration test (added to the CI `worker-role-contract` job). |
| SOLID / minimal / no live switch | OK. One new intent kind (`deal_note`) and one handler method. No defaults are flipped. |

## Suites run (throwaway Postgres 16 on :55432, migrated + `db:roles`, `--maxWorkers=2`)

- `apps/worker src/integrations/crm src/projectors`: 55 files passed. One failure, `crm-deal-naming-reader.integration.test.ts` (`shop_order_line_target_xor`), also fails on `origin/main` and is untouched by this PR.
- `crm-shop-order-sync.test.ts` + `crm-shop-order-sync.integration.test.ts`: 12/12 passed (integration ran, not skipped).
- `packages/types src/domain-event-catalog`: 29/29 passed.
- GitHub CI on the head: `ci-result`, `test` and `worker-role-contract` all succeeded.

## Findings (none blocking)

1. **A refund that arrives before the order's deal link is skipped for good and not alerted.** `apps/worker/src/integrations/crm/handlers/crm-deal-sync-handler.ts:131-133` (`updateDealStage`, reached from `crm-event-mappers.ts:428`). The claim order is `COALESCE(next_retry_at, created_at)` (`packages/persistence/src/repositories/drizzle-domain-event-delivery.repository.ts:82`). So if `shop.order.paid` is retrying or dead-lettered (for example, no person link yet), a later refund is skipped `deal_link_missing`. When the order deal is then created, it sits at the paid stage. This is the same behaviour as Bid's `payment.refunded`, and `replay:crm-skipped` can recover it, so it does not block. Better: for `shop.refund.completed`, return `retry` while the deal link is missing, or say in the doc table that the refund needs a replay after a late deal.
2. **The held-deal case loses the refund (acknowledged in the PR body).** `crm-deal-sync-handler.ts:134-136`. A refund on a held deal is skipped, and the held payload still says paid. When the buyer converts, the deal is created at the paid stage. It matches Bid and is documented, but it deserves a follow-up issue, because refunds of guest-held orders are a realistic case.
3. **The note write and its ledger row are not atomic.** `crm-deal-sync-handler.ts:194-216`. If `createRecord` succeeds and `upsertLink` throws, the retry adds a second note. This is the same pattern as `crm-paid-buyer-handler.ts:82-92`. It is low risk, so it is a nit.
4. **`shop.refund.reversed` is not routed** (`packages/types/src/domain-event-catalog/registry.ts:1392`). After a Stripe reversal the deal stays at the refunded stage. Out of scope, but worth a line in zoho.md's table so nobody assumes it is handled.
5. **Every refund moves the deal to refunded, including a partial one** (`crm-event-mappers.ts:428-440`). Documented as an owner decision; noted only.

## Infra / env

None needed. The types are enabled by listing them in `ZOHO_CRM_ENABLED_EVENT_TYPES` when an owner decides to.

## Fixes after review

Fixed on `fix/crm-shop-refund-fulfilment` in `8456e56f` (after merging `main`).

- **Finding 1 (fixed).** `shop.refund.completed` now retries while the order's deal link is missing, instead of skipping for good.
  - `apps/worker/src/integrations/crm/crm-event-mappers.ts:70,449`: the `deal_stage` intent gains `retryWhileDealMissing`, set only for `shop.refund.completed` (Bid's `payment.refunded` is unchanged).
  - `apps/worker/src/integrations/crm/crm-sync-service.ts:243` passes it on.
  - `apps/worker/src/integrations/crm/handlers/crm-deal-sync-handler.ts:141-145`: with no deal link, returns `retry` with `crmDealNotLinkedError()` (`crm-gateway-error.ts:45`, code `deal_link_missing`, retryable), so the existing retry and dead-letter policy bounds it. An erased link and a held deal are still skipped.
  - Tests: `crm-shop-order-sync.test.ts:107` (refund before the paid deal exists retries, then succeeds once the deal link is there), `:128` (erased link still skipped); `crm-event-mappers.test.ts:574`.
- **Finding 3 (fixed).** The note write is idempotent across a failed ledger write.
  - `crm-deal-sync-handler.ts:19`: `CRM_NOTE_PENDING_MODULE` (`__note_pending__`, record id `__none__`, so never "real" and never sent to Zoho by erasure).
  - `crm-deal-sync-handler.ts:228`: the ledger row is written pending before `createRecord`; `:240,244` set it back to "not added" when the call throws or Zoho refuses, so the retry sends again; the real link replaces it after success.
  - `crm-deal-sync-handler.ts:215-216`: a row left pending (note sent, then the ledger write failed) is not sent again: skipped `deal_note_maybe_added`. At most once, never twice. Remaining edge: a `createRecord` that times out after Zoho created the note resets the marker and can still duplicate, as before.
  - Tests: `crm-shop-order-sync.test.ts:175` (`upsertLink` fails after `createRecord`: one note across the retry), `:195` (a refused note is sent again); `crm-shop-order-sync.integration.test.ts:107` (same against the real `crm_record_link` as `worker_app`).
- **Finding 4 (fixed).** `docs/integrations/zoho.md:105`: `shop.refund.reversed` is not routed yet.
- **Finding 2 (doc only).** `docs/integrations/zoho.md:97`: "Known gap" line for refunds on held deals; behaviour unchanged.
- `docs/integrations/zoho.md:97-98` also describe the refund retry and the pending note row.
- **Finding 5:** unchanged (owner decision).

Suites (throwaway Postgres 16 on :55432, migrated + `db:roles`, `--maxWorkers=2`): `apps/worker src/integrations/crm src/projectors` 54 files passed, 348 tests; the one failure, `crm-deal-naming-reader.integration.test.ts`, is the same pre-existing failure on `main`. `crm-shop-order-sync` unit + integration (as `worker_app`): 17/17. `packages/types src/domain-event-catalog`: 29/29. `tsc --noEmit` (worker) clean; `biome check` clean.

## Final recheck

Head `8456e56f` (contains `main` at `6f2c0de8`). PR branch not changed.

- **The refund retry is correct and bounded.** With no deal link, `updateDealStage(..., { retryWhileDealMissing })` returns `retry` with `crmDealNotLinkedError()`. Only `shop.refund.completed` sets the flag; Bid's `payment.refunded` does not. An erased link and a held deal still skip.
  - The error is `retryable: true` and not `waiting`. A scratch test, not committed, confirmed `classifyDeliveryError` returns `retryable` and `isWaitingDeliveryError` returns `false`. So every retry uses one of the delivery's attempts and the delivery dead-letters at the usual limit; it cannot loop forever.
  - `crm-shop-order-sync.test.ts:107` shows retry, then success once the deal link exists. `:128` shows the erased link still skipped.
- **The note write is idempotent when `upsertLink` fails after `createRecord`.** A pending row (`__note_pending__` / `__none__`) is written before the send. A throw or a refusal resets it, so the retry sends again (`:195`). A row left pending is skipped (`deal_note_maybe_added`), so the note is never sent twice (`:175`). The same case runs against the real `crm_record_link` as `worker_app` (integration test, ran).
  - Erasure is not affected: `isRealZohoLink` rejects the `__none__` id, so erasure never sends a pending row to Zoho.
  - Accepted trade-off: a crash between the pending mark and the send leaves the note unsent. At most once is what the doc states.
- **Docs:** `zoho.md` has the `shop.refund.reversed` "not routed yet" row and the held-deal "Known gap" line, and describes the retry and the pending row.
- **Canary allowlist unchanged.** The PR does not touch `env.ts`, `.env*.example`, Terraform, `ERASURE_FOLLOWS_SYNC` or the always-on list. `ZOHO_CRM_ENABLED_EVENT_TYPES` appears only in test fixtures.
- **Suites** (throwaway Postgres 16 on :55432, migrated + `db:roles`, `--maxWorkers=2`):
  - `worker src/integrations/crm src/projectors`: 54/55 files; 348 tests passed, 1 skipped. The one failing file is `crm-deal-naming-reader.integration.test.ts` (`shop_order_line_target_xor`). It fails the same way on a tree whose CRM code equals `main` (#1561's worktree), so this PR did not cause it.
  - `crm-shop-order-sync` unit + integration: 17/17.
  - `types domain-event-catalog`: 29/29.
  - worker `tsc --noEmit` is clean.
- **PR body:** has no "Generated by/with" line.
- No regressions or new defects found.
