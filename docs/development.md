# Local Development

## Start the stack

Infrastructure only:

```sh
docker compose up -d postgres redis
```

Apps:

```sh
pnpm turbo dev --parallel
```

This starts all five apps: `apps/web` (3000), `apps/api` (3001), `apps/ws`
(3002), `apps/auth` (3003), and `apps/worker` (3004 — `/health` and `/metrics`
only).

## Database URLs

Local development can keep using the single owner-style `DATABASE_URL` from `.env.example`.

Production uses least-privilege URLs:

- `DATABASE_URL_OWNER` — migration Job only.
- `DATABASE_URL_AUTH` — Better Auth, OIDC, sessions, JWKS.
- `DATABASE_URL_API` — auction API.
- `DATABASE_URL_WORKER` — queue consumers and projectors.

Use the role-specific URLs locally only when testing grants:

```sh
psql "$DATABASE_URL_API" -c 'select count(*) from "user"'
psql "$DATABASE_URL_API" -c 'select * from jwks_key'
```

The second command should fail for `api_app`.

Role-contract gate (after migrations and `pnpm --filter @auction/db db:roles`):

```sh
AUTH_ROLE_CONTRACT_REQUIRED=true pnpm --filter @auction/db test:auth-role-contract
```

## Dual-host auth production parity

Keep both issuers running locally with the same `DATABASE_URL_AUTH`,
`BETTER_AUTH_SECRET`, `AUTH_DEK_KEY`, `OIDC_ISSUER_URL`, `COOKIE_DOMAIN`, and
`JWT_AUDIENCE`. Use `NEXT_PUBLIC_AUTH_URL=http://localhost:3003` for the standalone
path while the API remains on 3001. Then compare:

```sh
curl -fsS http://localhost:3001/.well-known/openid-configuration
curl -fsS http://localhost:3003/.well-known/openid-configuration
curl -fsSI http://localhost:3003/api/auth/get-session
```

Discovery must match, JWKS must expose the same keys, and auth responses must include
`Cache-Control: no-store, no-cache, must-revalidate, private`. The PR browser workflow
also runs this topology before the sign-in/session journey.

## OAuth callback testing

Use a stable ngrok or `cloudflared` tunnel when testing Google/Apple callbacks.
Point the tunnel at whichever app currently serves `/api/auth/*` — either
`apps/api` (port 3001) or `apps/auth` (port 3003); both are valid today
(D7 dual-stack).

```sh
ngrok http 3003   # or 3001 if pointing at apps/api
```

Set these on the auth/api process:

```env
API_PUBLIC_URL=https://YOUR-TUNNEL.ngrok-free.app
OIDC_ISSUER_URL=https://YOUR-TUNNEL.ngrok-free.app
NEXT_PUBLIC_AUTH_URL=https://YOUR-TUNNEL.ngrok-free.app
```

Register callback URLs in each provider:

- Google: `https://YOUR-TUNNEL.ngrok-free.app/api/auth/callback/google`
- Apple: `https://YOUR-TUNNEL.ngrok-free.app/api/auth/callback/apple`

Live OAuth round-trip:

1. Start postgres/redis and `pnpm turbo dev --parallel`.
2. Start the tunnel and update `API_PUBLIC_URL` / `OIDC_ISSUER_URL`.
3. Configure the OAuth client redirect URI in Google/Apple's console.
4. Sign in via Google.
5. Verify a session is created and `external_accounts(provider='google', external_id=<sub>)` exists.

Apple Sign-In requires the Apple Developer Program. If `APPLE_CLIENT_ID` and
`APPLE_CLIENT_SECRET` are empty, the Apple provider is intentionally skipped.
See [docs/security/social-login-setup.md](./security/social-login-setup.md) for
the full provider configuration.

## Seed users

Seeded social-provider test rows should use:

- `google-test@lax.bid`
- `apple-test@lax.bid`

Those emails are for local QA only. Production identity links are created by real provider `sub` claims and the `UNIQUE (provider, external_id)` constraint on `external_accounts`.
