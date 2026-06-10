# DigitalOcean App Platform

The full DigitalOcean topology is now declared in Terraform — see
[infra/terraform/](../../infra/terraform/) and the bootstrap procedure in
[BOOTSTRAP.md](../../infra/terraform/BOOTSTRAP.md). The notes below cover
DigitalOcean-specific operational knowledge that is not obvious from the
Terraform code alone.

## TLS for `auth.lax.bid`

Cloudflare full-strict TLS terminates user traffic at Cloudflare and re-encrypts
to the App Platform origin. The `auth.lax.bid` and `test-auth.lax.bid` hostnames
are bound to the App Platform component in
[infra/terraform/modules/digitalocean-app/](../../infra/terraform/modules/digitalocean-app/);
DigitalOcean provisions the Let's Encrypt origin certificate automatically.

Verification before exposing OIDC discovery publicly:

```sh
curl -sI https://auth.lax.bid/health/live
```

The response must include a valid certificate chain and a 200 status.

## Production migrations

Runtime app roles (`auth_app`, `api_app`, `worker_app`) do not have DDL grants.
Production migrations are run by a one-shot DigitalOcean Job before each deploy
(declared as a `pre_deploy` Job in the App Platform spec):

```sh
pnpm db:migrate:prod
```

Required secret for the Job only:

- `DATABASE_URL_OWNER`: privileged `auction_owner` connection string. Set on
  the migrate Job's env in App Platform; never bound to long-running components.

Optional role-password secrets used by `packages/db/src/migrate-roles.ts`:

- `AUTH_APP_DB_PASSWORD`
- `API_APP_DB_PASSWORD`
- `WORKER_APP_DB_PASSWORD`

`apps/api`'s entrypoint **does not run migrations**. If the Job has not run,
app startup should fail during readiness checks instead of mutating schema with
a runtime credential.

## Prebuilt images (DOCR)

All six App Platform components (`api`, `auth`, `ws`, `worker`, `migrate`, `web`)
are built in GitHub Actions (`.github/workflows/build-images.yml`) and pushed to
DigitalOcean Container Registry. App Platform pulls `lax-<env>-<component>:<env>`
on each deploy instead of building from source.

- Enablement: repository variables `USE_PREBUILT_IMAGES_*` and `APP_DEPLOY_SOURCE_*`
  (see [BOOTSTRAP.md §9](../../infra/terraform/BOOTSTRAP.md#9-prebuilt-images-docr--faster-app-platform-deploys)).
- Web build args: [`infra/web-build/README.md`](../../infra/web-build/README.md).
- Verify tags: `doctl registry repository list-tags lax-prod-web`.

Deploy logs should show **pulling** an image, not **building** from GitHub.

## Spaces uploads

A Space for user-uploaded media (`lax-media` in production, `lax-test-media` in
test) is provisioned by
[infra/terraform/modules/digitalocean-spaces/](../../infra/terraform/modules/digitalocean-spaces/)
and bound to `apps/api` and `apps/worker` through S3-compatible env vars
(`STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`).

CORS, lifecycle, and access keys live in the same module. The notable defaults
that operators sometimes need to revisit:

- Allowed CORS methods: `PUT`, `GET`, `HEAD`.
- Allowed CORS origins: the production and test web hosts plus
  `http://localhost:3000`.
- **No bucket lifecycle rule is configured in Terraform.** Validated uploads remain
  under `uploads/pending/...` indefinitely. Do **not** add a blanket
  `uploads/pending/` expiry rule — it would delete live media and KYB documents.
  Orphan cleanup is handled by the `gc-pending-uploads` worker (rows still in
  `pending` status after presign expiry).

Generate Spaces access keys with the Spaces role only. Store the key pair in
1Password and as the App Platform encrypted env vars
`MEDIA_SPACES_ACCESS_KEY_ID` / `MEDIA_SPACES_SECRET_ACCESS_KEY`. Rotate annually
or immediately on suspected exposure.
