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

P3 adds `apps/worker`; after that, the same Turborepo command starts API, WS, Web, and Worker.

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

## OAuth callback testing

Use a stable ngrok domain when testing Google/Apple callbacks:

```sh
ngrok http 3001
```

Set these for the API process:

```env
API_PUBLIC_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app
OIDC_ISSUER_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app
NEXT_PUBLIC_AUTH_URL=https://YOUR-NGROK-DOMAIN.ngrok-free.app
```

Register callback URLs in each provider:

- Google: `https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/auth/callback/google`
- Apple: `https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/auth/callback/apple`

Live OAuth round-trip test for P1.3:

1. Start postgres/redis and `pnpm turbo dev --parallel`.
2. Start ngrok and update `API_PUBLIC_URL` / `OIDC_ISSUER_URL`.
3. Configure Google OAuth client redirect URI.
4. Sign in via Google.
5. Verify a session is created and `external_accounts(provider='google', external_id=<sub>)` exists.

Apple Sign-In is tested only when the Apple Developer Program is available. If `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` are empty, the Apple provider is intentionally skipped.

## Seed users

Seeded social-provider test rows should use:

- `google-test@lax.bid`
- `apple-test@lax.bid`

Those emails are for local QA only. Production identity links are created by real provider `sub` claims and the `UNIQUE (provider, external_id)` constraint on `external_accounts`.
