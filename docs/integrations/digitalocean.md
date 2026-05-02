# DigitalOcean App Platform

## P1.1 deployment prerequisites

### `auth.lax.bid` certificate

Register `auth.lax.bid` as a domain on the API component before shipping OIDC discovery. This lets DigitalOcean provision the Let's Encrypt certificate early, so WordPress OIDC discovery does not fail TLS validation in P2.

Verification:

```sh
curl -sI https://auth.lax.bid/health/live
```

The response must include a valid certificate chain and a 200 status before `/.well-known/openid-configuration` is exposed publicly.

### Production migrations

Runtime app roles (`auth_app`, `api_app`, `worker_app`) do not have DDL grants. Production migrations are run by a one-shot DigitalOcean Job before each deploy:

```sh
pnpm db:migrate:prod
```

Required secret for the Job only:

- `DATABASE_URL_OWNER`: privileged `auction_owner` connection string.

Optional role-password secrets used by `packages/db/src/migrate-roles.ts`:

- `AUTH_APP_DB_PASSWORD`
- `API_APP_DB_PASSWORD`
- `WORKER_APP_DB_PASSWORD`

The API container no longer runs migrations on boot. If the Job has not run, app startup should fail during readiness checks instead of mutating schema with a runtime credential.

## Spaces uploads

Create a Space for user-uploaded media and bind it to `apps/api` and `apps/worker` through S3-compatible env vars.

Recommended production shape:

- Space name: `lax-media`
- Region: `fra1`
- Endpoint: `https://lon1.digitaloceanspaces.com`
- CDN endpoint: `https://lax-media.lon1.cdn.digitaloceanspaces.com`
- Runtime env: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`

Configure CORS on the Space:

- Allowed methods: `PUT`, `GET`, `HEAD`
- Allowed origins: `https://lax.bid`, `https://test.lax.bid`, `http://localhost:3000`
- Allowed headers: `Content-Type`, `x-amz-*`
- Exposed headers: `ETag`

Configure lifecycle cleanup as a second line of defense:

- Prefix `uploads/pending/`: expire after 1 day
- Prefix `uploads/active/`: no expiration

Generate Spaces access keys with the Spaces role only. Store the key pair in 1Password and DigitalOcean encrypted env; rotate annually or immediately on suspected exposure.
