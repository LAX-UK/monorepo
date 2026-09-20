# Dependency patches

## `better-auth@1.6.22`

Better Auth's OIDC provider copies `skipConsent` only from `trustedClients`,
which replace the database client record (secrets, redirect URLs, disabled).
LAX first-party web clients stay DB-backed, so this patch adds
`skipConsentClientIds` to `authorize()` and tightens prompt handling:

- listed clients skip consent unless `prompt=consent`
- `prompt=none` can complete silently with an active session and returns
  `login_required` instead of login UI when `max_age` requires reauthentication
- unsupported prompt tokens and `select_account` are rejected instead of ignored
- unauthenticated `prompt=none` checks client disablement after redirect
  validation
- token auth, PKCE, redirects, and disablement still use the DB row

The monorepo lockfile records pnpm 9 base32 patch hashes. Identity extraction
rewrites those hashes to pnpm 10 SHA-256 hex before `--frozen-lockfile`.

Remove the patch when upstream supports consent policy for database clients
and these prompt semantics. The issuer compatibility contract pins the patched
file hashes.
