Verdict: FIX FIRST

# Security review: PR #1465 (auth-atomic-terms-consent), AC-3

Reviewed commit `287e8716` against `origin/main` (`4fc09b9d`).

## Summary

The design is sound: the user row and both Terms/Privacy rows are written in one
Postgres transaction, and a failed acceptance insert rolls the user back (shown
against real Postgres 16 and confirmed by mutation testing). Only one item blocks
merge: the required CI job `static-checks` fails on an architecture rule. The
other findings do not block.

## Findings

1. **BLOCKING: `static-checks` fails (layer invariant).**
   `apps/auth/src/infrastructure/user-legal-acceptance-adapter.ts:54` constructs
   `new DrizzleLegalAcceptanceRecorder(...)` inside the infrastructure layer.
   `scripts/check-layers.mjs` only allows that in `@auction/persistence` or
   `apps/*/src/container/`. Reproduced locally (`node scripts/check-layers.mjs`
   exits 1). This is also the only failing check on the PR's CI run. Suggested fix:
   pass a factory such as `recorderOn: (tx) => LegalAcceptanceRecorder` in `deps`
   and build it in the container (or in `build-drizzle-database.ts`, if that site
   is allowed). Another option is to insert `legalAcceptanceRows(...)` through
   `tx` directly. Behaviour does not change either way.

2. Non-blocking: the `legalAcceptance` port is now dead wiring.
   `packages/auth/src/server.ts:225`, `packages/auth/src/auth-hooks/auth-hook-deps.ts:11`
   and `apps/auth/src/container/create-auth-issuer.ts:164` still supply the port,
   but nothing reads it any more. Any future `createAuth` built on a different
   database adapter would supply the port and record nothing, with no warning.
   Remove the port, or make `createAuth` assert that the adapter wrapper is
   present.

3. Non-blocking (latent): the wrapper opens its own transaction rather than joining an outer one.
   At `user-legal-acceptance-adapter.ts:51`, `deps.db.transaction` always starts a
   new top-level transaction. Today that is correct, because `drizzleAdapter` is
   configured without `transaction: true`, so Better Auth's `runWithTransaction`
   (used by `createOAuthUser`) runs on the plain adapter and holds no connection.
   If `transaction: true` is ever turned on, the user insert would run on a second
   pooled connection outside the outer transaction. That breaks atomicity with the
   account row and, under load, can exhaust the pool. Add a comment or test that
   pins this assumption, or reuse the active transaction.

4. Non-blocking: the doc comment overstates coverage.
   `user-legal-acceptance-adapter.ts:27` lists "magic link, passkey enrolment" as
   ways to create an account. Magic link runs with `disableSignUp: true`
   (`packages/auth/src/plugins/jwt-oidc.ts:146`), and passkey registration adds a
   credential to an existing user. Neither creates a user. Correct the comment so
   later reviewers are not misled.

## Verification of the requested points

- **Creation paths.** Every user insert goes through the single Better Auth adapter
  (`buildDrizzleDatabase` is its only production site), so every path passes
  through the wrapper.
  - **Email/password** (`/sign-up/email` with a statement): user and both rows are
    written in one transaction.
  - **Social/OAuth** (Google, Apple): the statement is read from server-side OAuth
    state via `getOAuthState()`, as before, and recorded in the same transaction as
    the user. The account row is written separately, which is unchanged from main.
  - **Magic link:** sign-up is disabled, so no account is created.
  - **Passkey:** registration needs an existing user, so no account is created.
  - **Phone number:** no sign-up on verification.
  - **Account linking:** creates no user row.
  - **Admin `createUser`:** there is no admin plugin and no direct
    `insert(user)` in application code.
  - **Staff-created accounts:** `apps/api` calls the issuer's `/sign-up/email`
    without a statement, so no record is written. That is the intended outcome:
    the person was not shown the statement, so none is claimed. It also matches
    main.
- **Same decision as before.** `getCurrentAuthContext()` comes from the same
  global async-local-storage that Better Auth's `createWithHooks` uses for the
  hook `context` (keyed with `Symbol.for`, and there is a single hoisted
  `@better-auth/core` copy). The decision logic (`signUpLegalAcceptance`) is
  unchanged.
- **No new trust in client data.** The request still contributes only `product`,
  and only as a member of the server's allow-list `LEGAL_ACCEPTANCE_PRODUCTS`.
  Document version, effective date and legal entity come from
  `acceptedLegalDocumentsFor(product)` (server config). Source is set by the
  server.
- **Rollback proven on real Postgres 16** (port 55432, after `db:migrate` and
  `db:roles`):
  - The integration test passed 3/3 as the superuser.
  - The happy path also passed as the least-privilege `auth_app` role. The forced
    failure case cannot run as `auth_app` because that role lacks the
    test-fixture privilege to create triggers, which is expected.
  - Mutation 1 removed the transaction: the "no user row when the record cannot
    be written" test failed.
  - Mutation 2 never recorded: 4 tests failed.
- **Other adapter operations are unchanged.** The wrapper overrides only `create`
  for `model === "user"` and re-wraps `transaction`. Everything else is spread
  through untouched. Envelope sealing runs outside this wrapper, so values are
  sealed before the insert. The `user` model has no sealed fields.
  - Ad-hoc check with the envelope enabled: an account token was stored sealed and
    read back unsealed, and a session create was unaffected.
  - 40 sequential sign-ups (user plus account inside `adapter.transaction`) left
    the pool at 1 total, 1 idle, 0 waiting. No connection leaked.
- **Dependency.** `@better-auth/core` is pinned to `1.6.22`, the same version as
  `better-auth`. The lockfile diff is 3 added lines that resolve to the
  already-present snapshot.
- **Local results:**
  - `packages/auth` vitest: 679/679 passed.
  - `apps/auth` vitest (with `DATABASE_URL`): 1874/1874 passed.
  - `tsc --noEmit` is clean for `apps/auth` and `packages/auth`.
  - `biome check` is clean.
  - `check-layers` fails (finding 1).
- **CI at review time:** `static-checks` failed (finding 1), 16 checks passed and
  the rest were still running.
