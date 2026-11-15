Verdict: SHIP

# Final recheck: PR #1465 (auth-atomic-terms-consent), AC-3

Rechecked head `5ee5805a`, the fix commit after the review of `287e8716`. The base is `4fc09b9d`, and GitHub reports the PR as mergeable against current `main`.

## Status of the previous findings

- **Finding 1 (BLOCKING, layer invariant): fixed.** `user-legal-acceptance-adapter.ts` no longer constructs `DrizzleLegalAcceptanceRecorder`. It inserts `legalAcceptanceRows(...)` into `subject_legal_acceptance` through the same `tx`, with `onConflictDoNothing()`, which is exactly what `recordSignUp` did. `node scripts/check-layers.mjs` passes locally, and the CI `static-checks` job is green.
- **Finding 2 (dead `legalAcceptance` port): fixed.** The port is removed from `AuthPorts`, the hook deps, `createAuth` and the issuer container. Nothing still supplies or reads it.
- **Finding 3 (outer-transaction assumption): addressed** with a comment at `apps/auth/src/infrastructure/user-legal-acceptance-adapter.ts:42`.
- **Finding 4 (doc comment): fixed** at `user-legal-acceptance-adapter.ts:28`.

## Verification

- **Atomicity on real Postgres 16.** A throwaway cluster on port 55432, with `db:migrate` and `db:roles` applied. The integration test passes 3/3, including "leaves no user row when the record cannot be written": a database trigger makes the acceptance insert fail, and the user row is rolled back.
- **Mutation check against the adapter.** All four mutations were killed:
  1. Inserting the user through the outer adapter instead of the transaction: 2 tests fail, including the Postgres rollback test.
  2. Removing the acceptance insert: 4 tests fail.
  3. Running the acceptance insert on the pool instead of `tx`: 3 tests fail.
  4. Swallowing the acceptance insert error: the unit rollback test fails. In Postgres the aborted transaction still refuses to commit, so the user row is not kept either.
- **Sign-up paths.** Every sign-up path still goes through the single wrapped adapter built in `build-drizzle-database.ts`. The decision (`signUpLegalAcceptance`) is unchanged.
- **Recorded fields.**
  - Version, effective date and legal entity come from `acceptedLegalDocumentsFor(product)`, which is server config.
  - `product` is accepted only from the server allow-list.
  - The server sets `source` and `acceptedAt`.
- **Sessions and passwords.** No change: the diff has no session, password, cookie or hashing file.
- **Attribution.** Neither commit nor the PR text has a `Co-Authored-By`, `Claude-Session` or generated-by line.
- **Local results:**
  - `apps/auth` vitest (with `DATABASE_URL`): 1874/1874 passed.
  - `packages/auth` vitest: 677/677 passed.
  - `tsc --noEmit` is clean for both.
  - biome is clean on the changed files.
  - `check-layers` and `lint:deps` pass.
- **CI on `5ee5805a`.** Every check passed, including `static-checks`, `build`, `browser-gates`, all vitest shards, the docker images, the role contracts and `ci-result`. `art-browser-gates` was skipped.

## Findings

1. **Non-blocking: the recorder class and its port are now used only by a test.** `DrizzleLegalAcceptanceRecorder` (`apps/auth/src/infrastructure/drizzle-legal-acceptance.recorder.ts:24`) and the `LegalAcceptanceRecorder` port (`packages/auth/src/ports/legal-acceptance-recorder.ts:19`) are referenced only by `drizzle-legal-acceptance.integration.test.ts`. In a follow-up, delete both, or keep only `legalAcceptanceRows`, so there is a single write path.
2. **Non-blocking: the PR description is partly out of date.** Its "Coverage of sign-up paths" section still lists magic link and passkey as sign-up paths. It also says staff-created accounts are not made through Better Auth, but they are made through the issuer's `/sign-up/email` without a statement, so nothing is recorded for them. "Changes after review" corrected the code comment but not this section. Update the description so it is accurate.
3. **Non-blocking: the rollback test needs a privileged role.** The forced-failure test can only run as a role that is allowed to create triggers, so in practice it runs only as the superuser. This is unchanged from the first review. A note in the test file header would help.
