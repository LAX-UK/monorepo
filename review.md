Verdict: SHIP

# Review of PR #1550: Xero status shows Connect when the saved tokens can no longer be read

Head `d60cc925` (one commit, by mahmoudamrspace, no trailers). Checked against the goal: on test, Bid admin > Finance > Xero returned 500 because `XeroTokenSealer.openOne` threw `XeroTokenSealingError("unreadable")` during the status read.

Nothing blocks the merge. The status read now returns a typed `reason: "reconnect_required"` state with no 500. The page shows Connect plus one line. Reconnecting upserts over the unreadable row. Every write path still goes through `findLatest()`, which throws, so they all fail closed. The findings are nits.

## What I ran (Postgres 16, local; migrations + `db:roles` applied)

| Suite | Result |
| --- | --- |
| `apps/api` `admin-xero-application.service.test.ts` | 4 passed |
| `packages/finance-runtime` `xero-auth-runtime.test.ts`, `xero-invoice-writer.test.ts` | 11 passed |
| `packages/persistence` `drizzle-xero-connection.repository.integration.test.ts` (real DB) | 7 passed |
| `apps/web` `xero-integration-panel.test.tsx` | 4 passed |

- `tsc --noEmit` is clean for api, web, persistence and finance-runtime. `biome check` is clean on the touched files.
- **Mutation:** I made `findLatestSummary` rethrow every sealing error. The integration test "reports tokens sealed with another key as unreadable…" fails, so the swallow path is pinned.

## Checks against the brief

- **Typed state, no 500.** `findLatestSummary` (`packages/persistence/src/repositories/drizzle-xero-connection.repository.ts:46-62`) catches only `XeroTokenSealingError` with code `unreadable` or `tokens_missing` and returns `tokensReadable: false`. `getStatusPayload` (`apps/api/src/services/admin/admin-xero-application.service.ts:96-110`) maps that to `connected: false, reason: "reconnect_required", health: "disconnected"`. The web schema accepts only `"reconnect_required"` or null. `key_missing` and any other error still throw, as the code comment says.
- **Page.** The panel shows "Not connected", the Connect Xero button (`!status.connected` branch) and one warning line (`xero-integration-panel.tsx:172-177`). I looked at the four screenshots (375 and 1440, light and dark). The line wraps cleanly at 375, there is no horizontal overflow, and the warning tone is legible in both themes.
- **Reconnect replaces the row.** `upsertConnection` conflicts on `tenantId` and writes all four columns from `seal()`: plaintext columns are set to null and new sealed values are written. Status is reset to `healthy`. The integration test proves that `findLatest` reads the new tokens after a reconnect. The callback (`xero-oauth.service.ts:40-86`) never reads the old row before upserting, so the unreadable row can't break a reconnect.
- **Write paths fail closed (code unchanged by this PR).** All of these still call `findLatest()`, which throws `xero_token_sealing_unreadable` before any Xero call:
  - `xero-invoice-writer.ts`: 50 (invoice push), 166 (payment sync) and 175 (webhook sync)
  - `xero-payment-recorder.ts`: 84 and 149
  - `xero-payout-bill.writer.ts:102`
  - `xero-auth-runtime.ts`: 51, 89 and 116 (refresh)

  How the callers handle the error:
  - The cron refresh turns it into `{ ok: false }` → 502 (`create-cron-services.ts:78-88`).
  - The webhook ingress calls `markFailed` with the error message (`xero-webhook-ingress-application.service.ts:110-112`), so the replay cron retries it after a reconnect.

  New tests prove that invoice push, payment sync and refresh refuse without calling Xero and without writing a pending ref. Nothing skips silently.
- **No token material.** The summary destructures out all four token columns before returning. The warning logs `{ tenantId }` and a fixed message, and only once per process. Tests assert that neither the log calls nor the summary contain the token values or the `v1:` envelope.
- **Minimal change.** About 90 lines of production code, no migration, no new endpoint. This is proportionate given Xero is being replaced by Zoho Books. The one avoidable edit is noted in finding 2.

## Findings

### 1. The comment says the status read "never opens the tokens", but it does (nit)
- **Where:** `apps/api/src/services/admin/admin-xero-application.service.ts:86`, and the same claim in the commit body.
- **Detail:** `findLatestSummary` calls `sealer.open(...)` to test readability (`drizzle-xero-connection.repository.ts:56`), then discards the result. Behaviour is correct and nothing leaks, but the comment misleads the next reader about where decryption happens.
- **Fix:** reword it to "never returns the tokens; it only checks they can still be opened".

### 2. `XeroOAuthService.getConnectionSummary` has no callers (nit, unnecessary Xero edit)
- **Where:** `apps/api/src/services/xero-oauth.service.ts:89-104`.
- **Detail:** a repo-wide grep finds no caller. Switching it to `findLatestSummary` is harmless but is work spent on dead Xero code.
- **Fix:** leave it, or delete the method in a later Xero clean-up. Not worth another round on this PR.

### 3. Failed sync and webhook counts are hidden while reconnect is required (low, by design)
- **Where:** `admin-xero-application.service.ts:96-110` returns the disconnected payload before the error counts at `:115`.
- **Detail:** while the tokens are unreadable, every money sync fails, but the page shows `syncErrorCount: 0` and `recentWebhookErrors: 0`. The "Not connected" badge and the warning already tell the admin to act, and the counts come back after the reconnect, so this does not block.
- **Fix (optional):** keep the counts in the reconnect-required payload.

### 4. A missing `XERO_TOKEN_DEK_KEY` still gives a 500 on the status page (note)
- **Where:** `drizzle-xero-connection.repository.ts:58`.
- **Detail:** this is intentional and documented: reconnecting could not store tokens without the key, so it is a configuration fault. Mentioned only so nobody mistakes it for the incident coming back if the key is unset on an environment.

### 5. The leftover row after reconnecting to a different organisation (note)
- **Detail:** the upsert is keyed on `tenantId`. Connecting a different Xero organisation inserts a new row, and the old unreadable row stays. `findLatest` and `findLatestSummary` both order by `updatedAt desc`, so the new row wins. Disconnect isn't offered while not connected (`xero-integration-panel.tsx:118`). Harmless, and no action is needed given the Zoho migration.
