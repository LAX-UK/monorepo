Verdict: SHIP

# Review of #1540: GAP-53 PR1 "Sell another like this"

Reviewed at `36329771` against `docs/design/decision-pack-2026-11-17.md` §5, option A and PR plan item 1 (approved 2026-11-17, Q7 default: no photos).

## What was run

- `apps/web`: `vitest run src/lib/seller src/components/dashboard/seller "src/app/(client)/selling"`. All passed: 12 files / 69 tests on the changed areas, and 30 files / 207 tests on the wider selling folders.
- `turbo run typecheck --filter=@auction/web`. Passed.
- `biome check` on the changed files. Clean.
- `lint:client-copy`, `lint:e2e-tags`, `lint:e2e-portfolio`, `lint:web-guardrails` and `lint:brand-name`. All passed.
- The Playwright spec `apps/web/e2e/org-roles-sell-another-like-this.spec.ts` (`@roles`) needs the seeded full stack and was **not run** here. It was read only.

## Blocking

None.

## Checked against the pack

- **Copied fields.** `COPIED_FIELDS` is categoryIds, medium, edition, isSigned and provenance (`apps/web/src/lib/seller/sell-another-like-this.ts:15-21`). `copyFromValues` starts from `EMPTY_SUBMISSION_FORM_VALUES`, so title, images, dimensions, askingPrice, reservePrice, conditionSelfReport, submitterNotes, description, yearOfWork, signatureNote and exhibitions stay blank. The unit test asserts each of these, and asserts the exact field list. Provenance entries are cloned, not shared.
- **Artist.** The pack lists artist, but neither `itemSubmissionFormSchema` (`packages/validators/src/item-submission.ts:46-64`) nor `ItemSubmission` has an artist field. Specialists link the artist only at approval. Leaving it out, with the reason documented at `sell-another-like-this.ts:8-13`, is right. It isn't a defect.
- **Ownership is checked on the server.** The page reads the source through `c.submissions.getMineById`, which is `GET /submissions/:id` with the acting legal entity (`apps/web/src/lib/data/http/submissions.reader.ts:64-72`). The API runs `requireSubmissionEntityContext` and then `access.canSee(legalEntity, submission)`, and answers `NOT_FOUND` otherwise (`apps/api/src/services/submission/submission-seller-http-application.service.ts:109-124`). That's the same rule the consignment page uses, so organisation members see their organisation's works and nobody else's. The page turns "not found" into `notFound()` (`apps/web/src/app/(client)/selling/new/page.tsx:141-146`), so a hand-typed `copyFrom` never gives a pre-filled or silently blank form.
- **Ownership tests.** The unit test covers a reader returning null and a reader throwing. The e2e covers the organisation case: the owner of Northbank, acting for Harrington Estate, gets "That page doesn't exist", with no notice and no wizard.
- **Entry points.**
  - Sent panel: a secondary `ButtonLink` beside "Sell another work" (`apps/web/src/components/dashboard/seller/submission-sent-panel.tsx:94-96`), wired at `selling/consignments/[id]/sent/page.tsx:42`.
  - Row menu: on every row with a submission, left out for a lot with none behind it (`consignment-row.tsx:66-74`).
  - Tests cover both, across every status.
- **Notice.** "Started from {title}." followed by "Check every step before you send it.", as an info `Notice` (`page.tsx:171-175`). The copy matches the pack.
- **Accent and case.** Uses the existing `@auction/ui/lax` `ButtonLink` and `Notice`, with no Shop tokens and no new colours. The label is sentence case and shared as `SELL_ANOTHER_LIKE_THIS_LABEL`. The sign-in round trip keeps `copyFrom` in `loginNext` (`page.tsx:100-104`).
- **Precedence.** A send-back or consign-again source takes priority, so only one notice explains the form.

## Non-blocking

1. **Every read failure becomes a 404.** `loadCopyFrom` maps any failed read to `not-found` (`sell-another-like-this.ts:67`), including a 5xx or network error, and the page then shows the 404 page. Only a real 404/null should become `notFound()`. Let `SubmissionsAccessError` and other failures reach `selling/new/error.tsx`, so a transient API failure doesn't tell a client their own work doesn't exist. (`consignValuesFor` has the same pattern today.)
2. **The page wiring has no unit test.** `notFound()` on a missing source, and `copyFrom` being ignored when `fromRejected` or `fromSubmission` is present, are covered only by the e2e, which isn't in the unit run.
3. **Small tidy-up.** `startedFromNotice(copyFrom.sourceTitle)` is called twice (`page.tsx:172-173`). Destructure it once.
