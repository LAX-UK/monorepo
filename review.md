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
