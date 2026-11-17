Verdict: SHIP

# Final recheck: PR #1529 "Release-alert send log, part 2: LAX Admin screen"

Rechecked head `1b44167b` against the previous review of `04bf91a1`. The fixes are in `7e6e2e6f`,
`d1f3bd70`, `3f064d80` and `1b44167b`, plus two normal merges of `origin/main`. Every commit is
authored and committed by `mahmoudamrspace` and none carries a trailer.

All ten earlier findings are fixed at the root. The independent pass found no real defects. Two low
notes follow, and neither blocks.

## Earlier findings: all fixed

1. **Long titles.** Fixed.
   - The Sending fixture now uses `RELEASE_ALERT_LONG_FIXTURE_TITLE`, a 104-character title
     (`apps/shop-api/src/infrastructure/seed/release-alert-sends-seed.ts:64`, `:81`).
   - The e2e and the client test check truncation, the full accessible name, one row height, no
     sideways scroll at 375, and that the panel actions stay in view.
   - New captures `send-log-long-title-{1440,375}-{light,dark}`. I viewed them: the title wraps in
     the panel header, and ↑/↓ and "Open artwork" stay in view at 375. The list row truncates with
     the badge kept inside the row.
2. **Told subscribers column.** Fixed and tested. Mutating the cell to always "Yes" now fails the
   suite (I re-ran this).
3. **Right-aligned counts (TBL-13).** Fixed and tested. Removing `numeric: true` from Waiting now
   fails the suite (I re-ran this).
4. **Stuck panel tone.** Tested with `data-tone`
   (`apps/shop-admin/src/components/leads/release-alert-send-log.client.tsx:345`).
5. **Panel URL for a release not on the page shown (PRD-7).** Fixed at the root. There is a real
   by-id read instead of a notice workaround.
   - The read is `GET /admin/v1/release-alerts/sends/:artworkId`
     (`apps/shop-api/src/routes/admin/v1/admin-release-alerts.routes.ts:61`). It:
     - calls `requireShopStaffCapability(request, "lead.read")` before any read;
     - validates the id as a UUID in the params schema, so a malformed id gets a 400 with no
       database read;
     - returns 404 when there is no release.
   - `ReleaseAlertSendLogStore.find` (`apps/shop-api/src/infrastructure/alerts/release-alert-send-log.store.ts:103`)
     uses the list's own query, with its shop-release and published filters, plus an `itemKey`
     filter. The list and `find` share one row-to-send mapper, `sendsOf`, so the panel cannot drift
     from its row.
   - The page reads it only when `?release=` is not on the page shown
     (`apps/shop-admin/src/app/(staff)/leads/release-alerts/page.tsx:25`).
   - The client opens the found row, with no place in the rows to step from. It opens a "Release
     alert not found" (warning) panel or a "could not be loaded" (danger) panel instead of nothing
     (`release-alert-send-log.client.tsx:106-110`, `:347`).
   - Mutations I re-ran, each killed: off-page row ignored; not-found panel not opened; missing-panel
     tone.
6. **Skeleton clipped at 1440.** Fixed at the cause: the column minimum widths (1,172 px) were wider
   than the card (about 1,135 px).
   - The columns are trimmed to 1,116 px.
   - In `loading-1440-dark.png` the skeleton's last column now sits inside the card, and the loaded
     table fits with `…` in view.
   - No kit change was needed.
7. **"Emailed 0 of 0" on a queued release.** Fixed. `releaseAlertPhoneCounts` returns null for
   `queued` (`apps/shop-admin/src/server/domain/release-alert-sends.vm.ts:113`). `send-log-375-dark.png`
   shows First light with its badge only. Mutation killed.
8. **Seed comment and `ALERTS_SEND_MODE`.** Fixed.
   - The seed comment now describes the scheduler correctly (`release-alert-sends-seed.ts:17-27`).
   - The workflow pins `ALERTS_SEND_MODE: "off"`, with a comment (`.github/workflows/e2e-pr.yml:205`).
   - `seedReleaseAlertFixtures` refuses to run under any other mode, and throws in CI
     (`apps/shop-admin/e2e/support/release-alert-fixtures.ts:27`).
9. **Session read failure drops the tab.** Fixed.
   - `releaseAlertSendsCapabilities` always adds `lead.read` on this page (`release-alert-sends.vm.ts:32`).
     That is sound: the page only renders once the `lead.read`-gated read has not refused.
   - It grants nothing else. "Open artwork" stays hidden and the server still enforces every read.
   - Mutation killed.
10. **Design doc.** Fixed. The intro is updated, and section 3 has an "As built" record
    (`docs/design/staff-gaps-delivery-zoho-alerts.md:389`). It covers the Edition title opening the
    panel, the by-id read, Counts not kept, and there being no no-results state.

## Independent pass

- **Security and authorization.**
  - Both reads are gated server-side on `lead.read`, and the route test covers the by-id read per role.
  - The page passes the off-page id through `encodeURIComponent`, and the API validates it as a UUID.
  - No subscriber or reason code reaches the client (Q9).
  - The account-manager check confirms there is no artwork link for a role without artwork capabilities.
  - Granting `lead.read` on the client is presentational only.
- **Correctness.** `find` cannot return a release the list would hide: it uses the same `where`, the
  same NULL-kind fallback and the same mapper.
- **SOLID and clean code.**
  - The `sendsOf` extraction removes duplication rather than adding it.
  - The `ReleaseAlertLinked` union is narrow.
  - The off-page fetch lives in the page (the loader), and the client only renders.
  - All copy is in `release-alert-sends.copy.ts`.
- **States.** I checked:
  - list, panel, stuck panel, long-title panel, loading and error at 1440 and 375 in light and dark,
    from the committed captures;
  - the off-page and not-found panels, through the tests and the PR's captures;
  - kit fit: `DetailPanel`, `Notice` tones, `MappedStatusBadge`, and `ListPage`/`DataViews` with no
    hard-coded colours.
- **The `1b44167b` e2e change.** The account-manager check moved into the existing staff-roles
  session to stay under the identity service's sign-in rate limit. The check is unchanged, and the
  helper still seeds through the guarded seed. No limit was loosened.

## Tests run

- shop-admin, against the PR head after building workspace packages, all passing:
  - `src/components/leads`
  - `release-alert-sends.vm.test.ts`
  - `src/app/(staff)/leads`
  - `lead-list.vm.test.ts`
  - `admin-nav.vm.test.ts`
  - `release-alert-metrics.test.ts`

  That is 6 files and 99 tests.
- shop-api: `admin-release-alerts.routes.test.ts` and the seed tests, 73 passed. The 22 skipped are
  the Postgres integration tests, which need a database. The store integration tests ran in CI as
  part of shop-api vitest 1–4/4, all green.
- Mutations re-run, all 7 killed:
  - Told cell always "Yes";
  - `numeric` removed from Waiting;
  - off-page row ignored;
  - not-found panel never opens;
  - missing-panel tone set to info;
  - queued phone line restored;
  - page using raw session capabilities.
- CI on `1b44167b` is green:
  - Web PR browser gates, run 44079531128, job 134026415307. The step "Run LAX Admin accessibility
    and role checks" reported **107 passed**, with nothing skipped or flaky, and ran with
    `ALERTS_SEND_MODE: off`.
  - The CI workflow's checks all passed: `ci-result`, web and shop-api vitest, smoke, build, static
    checks and the docker images.
  - Note: the two gate runs before this one, on `d1f3bd70` and `3f064d80`, failed. Those failures
    came from the off-page e2e assuming page neighbours and from the identity sign-in rate limit.
    `3f064d80` and `1b44167b` address those, and the latest run is clean.

## Low notes (not blocking)

- **A malformed `?release=` says "could not be loaded. Try again in a moment."**
  - **Where:** `apps/shop-admin/src/app/(staff)/leads/release-alerts/page.tsx:34-36`.
  - **What happens:** the API answers a non-UUID with 400, `fetchAdminJson` maps that to `failed`,
    and the panel shows the danger "could not be loaded" copy. Retrying never helps.
  - The comment at `:34`, and the `ReleaseAlertLinked` doc at `release-alert-sends.vm.ts:40`, say a
    malformed id is treated as `not_found`. The code does not do that.
  - **Fix:** a UUID check before the fetch, returning `not_found`, would make the code match its own
    docs. This only happens with a hand-edited URL, so it is cosmetic.
- **The off-page read runs after the list read.** It is sequential, and only when `?release=` is
  off-page, so it costs one extra round trip on that path. That is acceptable.
- **Carried over:** no fixture has a thumbnail, and the Edition link has no kit truncation tooltip.
  Both are noted in the PR as follow-ups.
