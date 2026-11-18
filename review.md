Verdict: SHIP

# Review: PR #1565 — check Zoho Status after each write and raise a staff edit as a conflict

Head `11971722`, base `122b816a` (main). Reviewed against `docs/integrations/zoho.md` (Status ownership) and `apps/worker/src/integrations/zoho/artwork/status`.

## Was the race real? Partly. The PR fixes a narrower case than its description claims.

- **Real and still open:** a staff edit that Zoho applies between LAX's pre-write re-read (`zoho-status-sync.ts:277`) and LAX's update is overwritten without a trace. The PR leaves this race in place and documents it honestly (`docs/integrations/zoho.md:222`).
- **What the PR detects:** an edit that Zoho applies *after* LAX's update. On main that edit was **not lost**. `recordCatalogueStatusWritten` already set last-written to `wanted`, so the next event or nightly pass sees `zohoStatus ≠ lastWritten` and `decideStatusWrite` returns `conflict` (unless the value is blank or `Available`, which compare-and-set replaces by design). The PR's "silently lost" framing therefore overstates the problem. The change raises that conflict at once instead of on the next pass, and reports the outcome as `conflict` rather than `written`. That is worth having, but it is earlier detection, not loss prevention.

## Checklist

| Check | Result |
|---|---|
| Pre-write re-read | Unchanged and correct (`sameState`, Status + `Modified_Time`, :277). |
| Post-write verification | Mostly correct (:318-355). It reuses `decideStatusWrite` with `lastWritten: wanted`, so only a value compare-and-set would not replace is raised. It is under the artwork advisory lock and only on `live` writes. See findings 1-2 on Modified_Time/Modified_By. |
| Integration-user identity | Not used. `Modified_By` is parsed (`zoho-status-products.ts` `userId`) and only logged and returned as `changedBy` (:335). The decision is based on the Status alone. That is enough for the decision, but see finding 3. |
| Staff edit raises the existing conflict, never reverted | OK. `recordCatalogueStatusConflict` is the same path as before. There is no second write, and the test `restores nothing` asserts a single write. The writeback service maps the outcome to `status_conflict_raised`. |
| Extra calls bounded | OK. Exactly one extra COQL read per live Status write, through the shared limiter; none in a dry run, which is tested. **The credit cost is not noted in the docs**; see finding 4. |
| Verification-read failure | Safe. The error is caught and logged as `zoho_status_write_check_failed`, the write stands, and the next pass compares again (tested). A failure in `recordCatalogueStatusConflict` falls into the outer catch, which gives `failed` and a retry, and the retry then sees the conflict. That is fine. |
| Tests simulate the race | They simulate an edit landing *after* the write (via `products.write` mocking). No test pins the documented residual race (edit before the write → undetected); adding one is optional. |

## Findings (none block)

1. **A stale post-write read would raise a false conflict.** `checkAfterWrite` (`zoho-status-sync.ts:333`) treats any `after.status ≠ wanted` as someone else's edit. If the COQL read right after the update returns the pre-write row, `after.status` is the old value. That value is not `wanted`, not blank and not `Available`, so a conflict is raised that nobody caused. Zoho does not document COQL read-after-write consistency.
   - The method already has the evidence to tell these apart: a real edit moves `Modified_Time` (and `Modified_By`), while a stale read equals `latest` (the pre-write state). A `sameState(after, latest)` guard, treated as "unverified, leave for next pass", would rule this out.
   - Impact is low. The conflict self-closes on the next pass, because Zoho then shows `wanted` and the `ledger.conflictOpen` branch closes it. That is why this does not block.
2. **`Modified_Time` from the post-write read is not used as evidence.** It is only stored as `zohoModifiedAt` (:340). Combined with finding 1, comparing it against the pre-write `latest.modifiedAt` is the cheap way to make "someone else changed it" a fact rather than an inference.
3. **No integration-user comparison.** A Zoho workflow rule or blueprint that changes Status in response to LAX's own update runs as the integration user. It would be raised as a staff edit, with `changedBy` set to the integration user's id. Comparing `Modified_By` with the connected user (the org check already calls Zoho at startup) would separate automation from staff. The code comment and doc say "someone else's edit" (`docs/integrations/zoho.md:220`), which is not strictly true in that case.
4. **The credit cost is not documented.** The PR body says "one extra COQL read per live Status write", but `docs/integrations/zoho.md` (Status section) does not mention the extra call or its API-credit cost. Other sections do, e.g. "Calls per event" at :295. With #1563, a go-live catch-up of a large artwork backlog makes 3 reads + 1 update per Status write. Add a line.
5. **PR description accuracy.** See "Was the race real?" above. The fix is sound, but "a staff edit … is silently lost … nothing tells staff" is true only for the residual window this PR does not close.

## Verification

- `vitest run --maxWorkers=2 src/integrations/zoho src/projectors` (worker, `DATABASE_URL` set to a throwaway Postgres 16 on 55432, migrated): 92 files, 732 passed, 7 skipped.
- `artwork-register.integration.test.ts` (persistence, same DB): 55 passed.
- Worker `tsc --noEmit`: clean.
- Merged with #1563 locally: auto-merge succeeded (only `docs/integrations/zoho.md` overlaps, in different sections), `tsc` is clean, and `src/integrations/zoho` gives 539 passed. The two PRs do not conflict.

## Fixes after review

Fixed on `fix/zoho-status-write-race` in `66673d3f` (then merged main as `2c7f3767`; no conflicts). Line numbers are at `66673d3f`.

1. **Stale post-write read no longer raises a conflict.** `checkAfterWrite` now takes the pre-write re-read (`before`) and, when the read after the write does not show `Modified_Time` moving past it (or Zoho returned none), treats the result as unverified: no conflict, an info log `zoho_status_write_unverified`, and the next pass decides. `apps/worker/src/integrations/zoho/artwork/status/zoho-status-sync.ts:355` (log at :364). Test: `zoho-status-sync.test.ts:576` (stale read → `written`, no conflict, no warn, next pass `in_sync`).
2. **`Modified_Time` movement is the evidence.** `modifiedSince(before, after)` at `zoho-status-sync.ts:412`, used at :355. Test: `zoho-status-sync.test.ts:600` (staff edit that moved `Modified_Time` → conflict, `cause: "staff"`).
3. **Integration user separated from staff.** `causeOf` at `zoho-status-sync.ts:398` compares `Modified_By` with the integration user id. A match is still raised, never reverted, on the existing conflict/ledger, with `cause: "zoho_automation"`, label `ZOHO_AUTOMATION_CHANGED_STATUS` = "Zoho automation changed Status" (:65) and log `zoho_status_changed_by_automation` (:382). The cause is carried on the `conflict_recorded` history event (`packages/persistence/src/interfaces/artwork-register.ts:189`, `drizzle-artwork-register.repository.ts:808` and :1062), and LAX Admin's timeline title reads "Zoho automation changed the Zoho Status…" (`apps/shop-admin/src/server/domain/zoho-register.vm.ts:534`). No new UI or schema.
   - Identity: the startup org check reads `GET /crm/v8/org`, which carries no CRM user id, so there was nothing to reuse. Instead `zohoCrmIntegrationUserId` (`apps/worker/src/integrations/zoho/zoho-crm-current-user.ts:21`) calls `GET /crm/v8/users?type=CurrentUser` only the first time a check finds a change, then caches it for the process. Failures are cached for 15 minutes and the change is treated as staff's. Wired at `apps/worker/src/container/create-zoho-status-sync.ts:36`, dep at `zoho-status-sync.ts:143`. This adds no Zoho call per write. It needs the optional `ZohoCRM.users.READ` scope.
   - Tests: `zoho-status-sync.test.ts:628` (automation case), plus "asks only when a change is found" and "unknown user means staff"; `zoho-crm-current-user.test.ts`; `zoho-register.vm.test.ts` (wording); `artwork-register.integration.test.ts` (cause stored on the event).
4. **Credit cost documented.** `docs/integrations/zoho.md:220` (evidence rule, automation label), `:229` ("Calls and API credits per Status write": 3 COQL reads + 1 update per live Status write, with the go-live catch-up note) and `:245` (optional scope).
5. **PR description.** The "silently lost" sentence now says that an edit applied after LAX's update was only late (the next pass already raised it), and that the only edit lost without a trace is one applied in the residual window between the pre-write re-read and the update. The Fix, Tests and Risk sections list the follow-up.

Verification (Postgres 16 on 55432, migrated):
- Worker `vitest run --maxWorkers=2 src/integrations/zoho src/projectors src/container`: 99 files passed, 777 tests passed. The skipped files are the role-contract and fulfilment reader integration suites, which need DB roles.
- Persistence `artwork-register.integration.test.ts`: 56 passed.
- Shop-admin `zoho-register.vm.test.ts`: 50 passed.
- `tsc --noEmit` is clean for worker, persistence and shop-admin, and `biome check` is clean on the touched files.
