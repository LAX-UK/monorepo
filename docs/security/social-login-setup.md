# Social Login Setup

This runbook configures Google Sign-In and Sign in with Apple for the Better Auth issuer.

## Runtime Inputs

The auth issuer reads these variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_SECRET`
- `APPLE_DOMAIN_ASSOCIATION`

Apple client-secret generation also needs:

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`

In production, the canonical issuer is `https://auth.lax.bid`, so callback URLs use that host.

## Google

1. Open Google Cloud Console.
2. Create or select the LAX project.
3. Go to APIs & Services, then OAuth consent screen.
4. Choose External unless the project is restricted to a Google Workspace.
5. Set the app name, support email, developer contact email, and production domain.
6. Add the scopes `openid`, `email`, and `profile`.
7. Go to Credentials, then Create credentials, then OAuth client ID.
8. Choose Web application.
9. Add authorized redirect URIs:
   - `http://localhost:3001/api/auth/callback/google`
   - `https://test-auth.lax.bid/api/auth/callback/google`
   - `https://auth.lax.bid/api/auth/callback/google`
10. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
11. Deploy the API and auth services.

## Apple

Sign in with Apple requires a paid Apple Developer Program account.

1. Open Apple Developer, then Certificates, Identifiers & Profiles.
2. Under Identifiers, register an App ID such as `bid.lax.app`.
3. Enable the Sign in with Apple capability on that App ID.
4. Register a Services ID such as `bid.lax.web`. This value is `APPLE_CLIENT_ID`.
5. Enable Sign in with Apple on the Services ID and configure it:
   - Primary App ID: the App ID from step 2.
   - Domains: `auth.lax.bid` and `test-auth.lax.bid`.
   - Return URLs: `https://auth.lax.bid/api/auth/callback/apple` and `https://test-auth.lax.bid/api/auth/callback/apple`.
6. Download Apple's `apple-developer-domain-association.txt` content for each domain.
7. Set that file content in `APPLE_DOMAIN_ASSOCIATION` for the matching environment.
8. Deploy `apps/auth`.
9. Verify the endpoint:

```bash
curl https://auth.lax.bid/.well-known/apple-developer-domain-association.txt
```

10. Complete domain verification in the Apple Developer console.
11. Under Keys, create a Sign in with Apple key linked to the App ID.
12. Download the `.p8` key once and store it in 1Password.
13. Record the Team ID and Key ID.

## Apple Client Secret

Apple's `client_secret` is a signed ES256 JWT. It expires after at most 180 days.

Generate it from the repo root:

```bash
APPLE_TEAM_ID=TEAMID1234 \
APPLE_KEY_ID=KEYID1234 \
APPLE_CLIENT_ID=bid.lax.web \
APPLE_PRIVATE_KEY="$(cat AuthKey_KEYID1234.p8)" \
pnpm gen:apple-secret
```

Paste the output into `APPLE_CLIENT_SECRET` for the target environment, deploy `apps/api` and `apps/auth`, then smoke-test Sign in with Apple.

Rotate `APPLE_CLIENT_SECRET` at least every 180 days:

1. Generate a fresh JWT with `pnpm gen:apple-secret`.
2. Update `APPLE_CLIENT_SECRET` in the environment and 1Password.
3. Deploy `apps/api` and `apps/auth`.
4. Sign in with Apple in staging or production to confirm the new secret works.

## Smoke Tests

Google can be tested locally if the Google OAuth client includes the localhost callback URL.

Apple cannot use `localhost` as a registered web domain. Test Apple on the public test or production auth domain after domain verification passes.

Expected database results:

- A social sign-in creates or reuses a `user` row.
- Better Auth writes an `account` row with `provider_id = 'google'` or `provider_id = 'apple'` (via the Better Auth `account` table).
- `accountLinking.trustedProviders` is `[]` in code — linking requires the provider to assert a verified email (Google does; Apple relay emails link by `sub` only).
- Existing verified email/password accounts are linked to Google or Apple when the provider returns the same verified email.
- Apple private relay emails (`@privaterelay.appleid.com`) are not linked to an existing user by email.
