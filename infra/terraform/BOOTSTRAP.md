# Terraform bootstrap

This file captures the one-time manual steps that must happen before Terraform
can manage the `lax.bid` infrastructure. Do not create any application
resources here; this document only prepares credentials, the remote state
bucket, the Cloudflare zone, and third-party consoles.

## 1. DigitalOcean API token

Create a DigitalOcean personal access token with read/write access:

```sh
gh secret set DIGITALOCEAN_TOKEN
```

The token is used by Terraform, `doctl`, and the app deployment workflows.

### GitHub access for App Platform (required before `digitalocean_app`)

Terraform declares components that build from  
`https://github.com/LAX-UK/monorepo.git` (see `repository_clone_url`; the slug `LAX-UK/monorepo` feeds the **`github`** source in the App spec).  
**Private repos** must use **`github { repo branch }`** (GitHub App), not **`git { repo_clone_url }`**, which is unauthenticated HTTPS and often surfaces as **Account does not have access to the repo** (DigitalOcean terraform-provider [#547](https://github.com/digitalocean/terraform-provider-digitalocean/issues/547)).  
Creating the app still requires the **DigitalOcean GitHub App** for that slug. If you see  
`Account does not have access to the repo`, grant access:

1. Open [GitHub install for App Platform](https://cloud.digitalocean.com/apps/github/install) (while logged into the **same** DigitalOcean team that runs Terraform).
2. Under repository access, include organization **`LAX-UK`** and repository **`monorepo`** (or “All repositories” for that org, if acceptable).
3. On GitHub: **Organization settings → Third-party access / GitHub Apps → DigitalOcean** and confirm **`monorepo`** is allowed (especially after moving the repo under an org).
4. Re-run the ephemeral Terraform apply.

You can override the clone URL with `TF_VAR_repository_clone_url` if the canonical remote differs.

## 2. Spaces state bucket

DigitalOcean Spaces bucket names are globally unique. Try the canonical name
first, then fall back to a suffixed name if it is unavailable.

```sh
export DO_SPACES_REGION=lon1
export STATE_BUCKET_NAME=lax-tf-state

doctl spaces bucket create "$STATE_BUCKET_NAME" --region "$DO_SPACES_REGION" || {
  export STATE_BUCKET_NAME="lax-tf-state-$(openssl rand -hex 4)"
  doctl spaces bucket create "$STATE_BUCKET_NAME" --region "$DO_SPACES_REGION"
}

doctl spaces bucket update "$STATE_BUCKET_NAME" --region "$DO_SPACES_REGION" --versioning-enabled
gh secret set STATE_BUCKET_NAME --body "$STATE_BUCKET_NAME"
```

Record the actual bucket name in this file after creation:

```text
STATE_BUCKET_NAME=lax-tf-state
```

Terraform state keys:

- `persistent-test/terraform.tfstate`
- `persistent-prod/terraform.tfstate`
- `sentry-test/terraform.tfstate`
- `sentry-prod/terraform.tfstate`
- `ephemeral-test/terraform.tfstate`
- `ephemeral-prod/terraform.tfstate`

Ephemeral stacks attach Postgres, Managed Caching, and App Platform to **`lax-test-project`** / **`lax-prod-project`**. The project id is **`TF_VAR_digitalocean_project_id`** (optional override), then the matching persistent remote state **`digitalocean_project_id`** output if present, then a **`digitalocean_projects`** API lookup by that exact project name—so ephemeral apply usually works without re-applying persistent first.

JWKS snapshots live under:

- `secrets-backup/jwks/test/`
- `secrets-backup/jwks/prod/`

## 3. Spaces access keys

Create three Spaces access keys in the DigitalOcean control panel under
`API > Spaces Keys`.

- `tf-state-rw`: Terraform state and JWKS snapshots. Store as GitHub secrets
  `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`.
- `media-rw`: application runtime access to `lax-media`. Store as App Platform
  encrypted env vars.
- `dev-rw`: local development access scoped operationally to `test/*`; store in
  1Password, not GitHub.

Terraform backend credentials are S3-compatible credentials, not the
DigitalOcean API token.

## 4. Cloudflare zone

Register `lax.bid` and move nameservers to Cloudflare before TF-P2.

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

The token needs Zone Read and Zone Edit permissions for `lax.bid`.

All ten public hostnames live in one Cloudflare zone:

| Purpose | Production | Test |
|---|---|---|
| web | `lax.bid` | `test.lax.bid` |
| api | `api.lax.bid` | `test-api.lax.bid` |
| auth | `auth.lax.bid` | `test-auth.lax.bid` |
| ws | `ws.lax.bid` | `test-ws.lax.bid` |
| media | `media.lax.bid` | `test-media.lax.bid` |

## 5. OAuth callbacks

Create or update OAuth clients before TF-P4 ships the auth component.

Google redirect URIs:

- `https://auth.lax.bid/api/auth/callback/google`
- `https://test-auth.lax.bid/api/auth/callback/google`

Apple Sign-In is disabled for v1, but the future redirect URIs are:

- `https://auth.lax.bid/api/auth/callback/apple`
- `https://test-auth.lax.bid/api/auth/callback/apple`

## 6. Sentry

Create the Sentry organization and team used by Terraform. **Confirm slugs in the Sentry UI** — do not guess:

| Setting | Where to find it | Terraform default |
|---|---|---|
| Organization slug | Settings → General Settings (URL: `sentry.io/settings/{slug}/`) | `lax-bid` |
| Team slug | Settings → Teams → pick team → slug in URL or team settings | `lax-engineering` |

**Region:** `lax-bid` is on **US** Sentry (`https://lax-bid.sentry.io`). CI workflows and
`sentry-cli` must use `SENTRY_URL=https://sentry.io` — **not** `https://de.sentry.io` (EU).
A 404 on org lookup against `de.sentry.io` usually means the wrong regional API host, not a bad token.

If the team does not exist yet, create it under **Settings → Teams** before running apply.
Projects are assigned to this team automatically.

**Important:** the **slug** is not always the same as the display name. After creating or
renaming a team, open it in Sentry and copy the slug from the URL:
`sentry.io/settings/lax-bid/teams/{slug}/`

### Validate before first apply

Check each value against your Sentry / GitHub setup:

| Assumption | Default | Required now? | How to verify |
|---|---|---|---|
| Org slug | `lax-bid` | **Yes** | Settings → General |
| Team slug | `lax-engineering` | **Yes** | Settings → Teams (404 = wrong slug or team missing) |
| GitHub repo for code mappings | `LAX-UK/monorepo` | Only if `SENTRY_GITHUB_INTEGRATION_ID` set | Settings → Integrations → GitHub |
| GitHub integration ID | (secret) | Optional | Personal token curl — see below |
| Slack integration name | `Slack` | No (alerts skipped) | When enabling Slack later |
| Slack channel | `#alerts-engineering` | No | When `SENTRY_SLACK_CHANNEL_ID` set |
| PagerDuty service | `lax-primary` | No (prod paging deferred) | When `PAGERDUTY_INTEGRATION_KEY` set |
| Alert email | `support@lax.bid` | No (alerts skipped) | When alerts enabled |
| Project names | `lax-test-{web,api,auth,ws,worker}` | Auto-created | No pre-existing projects needed |

### Internal integration (terraform-bot)

> **Do not use an Organization Token** (Settings → Auth Tokens → Organization Tokens).
> Those only grant `org:ci` for sentry-cli. Terraform needs an **Internal Integration**
> under **Developer Settings → Internal Integrations**.

> **Internal integration tokens cannot list org integrations** (Sentry returns HTTP 403
> on `/organizations/{slug}/integrations/` even with full scopes). Terraform accepts
> the GitHub integration ID via `SENTRY_GITHUB_INTEGRATION_ID` instead.

In Sentry → **Settings → Developer Settings → Internal Integrations**, create
`terraform-bot` and grant these **Permissions**:

| Permission | Level | Notes |
|---|---|---|
| Organization | Read | `org:read` |
| Team | Read & Write | `team:write` |
| Project | Admin | `project:admin` |
| Release | Admin | `project:releases` |
| Member | Read | `member:read` |
| Alerts | Read & Write | `alerts:write` |
| Continuous Integration (CI) | ✅ enabled | `org:ci` for code mappings |

After editing permissions, **generate a new token** (existing tokens do not pick up changes).

Store the token (set on repo **and** `--env test` / `--env prod` if workflows use environments):

```sh
gh secret set SENTRY_AUTH_TOKEN
gh secret set SENTRY_AUTH_TOKEN --env test
gh secret set SENTRY_AUTH_TOKEN --env prod
```

Use an **Internal Integration** token (`terraform-bot`), not a personal user auth token
and not an **Organization Token** (`org:ci` only).

```sh
# Quick local check (paste terraform-bot token at prompt)
read -rs token; printf '%s' "$token" | tr -d '[:space:]' | \
  xargs -I{} curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer {}" https://sentry.io/api/0/

# Org-scoped access on US SaaS (expect HTTP 200; 404 on de.sentry.io means wrong region)
read -rs token; printf '%s' "$token" | tr -d '[:space:]' | \
  xargs -I{} curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer {}" \
  "https://sentry.io/api/0/organizations/lax-bid/"

read -rs token; printf '%s' "$token" | tr -d '[:space:]' | \
  xargs -I{} curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer {}" \
  "https://sentry.io/api/0/organizations/lax-bid/teams/lax-engineering/"
```

### GitHub integration ID (for code mappings)

1. Install **GitHub** in Sentry → **Settings → Integrations** and link `LAX-UK/monorepo`.
2. Look up the integration ID **once** with a personal auth token (internal integration tokens cannot list integrations):

```sh
read -rs token; printf '%s' "$token" | tr -d '[:space:]' | \
  xargs -I{} curl -sS \
  -H "Authorization: Bearer {}" \
  "https://sentry.io/api/0/organizations/lax-bid/integrations/?providerKey=github"
```

Copy the `"id"` field from the response (numeric string, e.g. `"123456"`).

3. Store as a GitHub secret:

```sh
gh secret set SENTRY_GITHUB_INTEGRATION_ID --body "123456"
gh secret set SENTRY_GITHUB_INTEGRATION_ID --env test --body "123456"
gh secret set SENTRY_GITHUB_INTEGRATION_ID --env prod --body "123456"
```

Without this secret, sentry apply still creates **projects and DSNs** but skips GitHub code mappings.

### Third-party integrations (optional for first apply)

**Slack and PagerDuty alerts are deferred until you set the matching GitHub secrets.** With only `SENTRY_AUTH_TOKEN`, Terraform still creates projects and DSN keys — but skips issue/metric alerts and GitHub code mappings until `SENTRY_GITHUB_INTEGRATION_ID` is set.

When you are ready for Slack alerts:

1. Install **Slack** in Sentry → **Settings → Integrations** and connect `#alerts-engineering`.
2. Copy the Slack **channel ID** (`C…`) from the channel About tab.
3. Set `SENTRY_SLACK_CHANNEL_ID` on the `test` and/or `prod` GitHub environment.
4. Re-apply `infra/terraform/sentry/{env}` — alert rules are created on the next plan/apply.

For prod paging, also install **PagerDuty** in Sentry and set `PAGERDUTY_INTEGRATION_KEY` on the `prod` environment.

Add GitHub environment secrets when ready:

```sh
gh secret set SENTRY_SLACK_CHANNEL_ID --env prod --body "C0123456789"
gh secret set SENTRY_SLACK_CHANNEL_ID --env test  --body "C0123456789"
gh secret set PAGERDUTY_INTEGRATION_KEY --env prod   # prod only, when paging is ready
```

### Apply order

Sentry now lives in **`infra/terraform/sentry/{prod,test}`** (state keys
`sentry-prod/terraform.tfstate`, `sentry-test/terraform.tfstate`). Apply **after**
`persistent/{env}` and **before** `ephemeral/{env}` so DSN outputs can be consumed
via `terraform_remote_state`.

If `SENTRY_AUTH_TOKEN` is absent, the sentry stack creates no resources; ephemeral
continues without DSN env vars until you add the token and apply `sentry/{env}`.

**Data scrubbing** (sensitive fields) is not yet exposed by provider `0.14.13`;
configure once in Sentry UI → Project → Security & Privacy, and rely on SDK
`beforeSend` scrubbing in `@auction/observability`.

**Cron monitors** are upserted by worker SDK check-ins using slugs from
`sentry/{env}` outputs until `sentry_cron_monitor` lands in a future provider release.

Legacy Sentry projects in `persistent/{env}` were removed; management lives in
`sentry/{env}` only. If your persistent state still tracks the old modules, drop
them without destroying Sentry projects (run from `persistent/{env}` after init):

```sh
terraform state rm 'module.sentry_projects[0]' 2>/dev/null || true
terraform state rm 'module.sentry_alerts[0]' 2>/dev/null || true
```

Then re-apply `persistent/{env}` before applying `sentry/{env}`.

## 7. GitHub environments and secrets

Create GitHub Environments named `test` and `prod`. Required reviewers stay off
for now; production apply still requires the typed `APPLY-PROD` confirmation.

### App deploy workflows (`doctl apps create-deployment`)

Pushes to `main` / `release` run `.github/workflows/app-deploy-test.yml` and
`.github/workflows/app-deploy-prod.yml`. Those jobs **skip** DigitalOcean until
the app id secrets exist (you will only see an echo in the log).

Set these after the matching **ephemeral** stack has created the App Platform app:

| Secret | GitHub environment | Source |
| --- | --- | --- |
| `DO_TEST_APP_ID` | `test` | `terraform output -raw app_id` from `infra/terraform/ephemeral/test` |
| `DO_PROD_APP_ID` | `prod` | `terraform output -raw app_id` from `infra/terraform/ephemeral/prod` |

The repository must also expose **`DIGITALOCEAN_TOKEN`** to those jobs (see
**§1. DigitalOcean API token** above); the workflows read `secrets.DIGITALOCEAN_TOKEN`.

Example (from a machine with `gh` logged in and Terraform initialized against the right backend):

```sh
# Test app id → GitHub environment `test`
gh secret set DO_TEST_APP_ID --env test --body "$(cd infra/terraform/ephemeral/test && terraform output -raw app_id)"

# Prod app id → GitHub environment `prod` (after prod ephemeral exists)
gh secret set DO_PROD_APP_ID --env prod --body "$(cd infra/terraform/ephemeral/prod && terraform output -raw app_id)"
```

Or copy the UUID from **DigitalOcean → Apps → your app** (id appears in the app URL) and paste into **GitHub → Settings → Environments → `test` / `prod` → Add secret**.

Per-environment secrets needed before the first app deployment:

- `BETTER_AUTH_SECRET`
- `MEDIA_SPACES_ACCESS_KEY_ID`
- `MEDIA_SPACES_SECRET_ACCESS_KEY`

`BETTER_AUTH_SECRET` can be omitted for the first Terraform apply; Terraform
generates a stable placeholder in state so App Platform can boot. Replace it
with a GitHub environment secret before real users sign in.

The media Spaces keys can also be omitted for the first apply; Terraform uses
placeholder values so health checks can pass, but uploads will not work until
the real `MEDIA_SPACES_ACCESS_KEY_ID` and `MEDIA_SPACES_SECRET_ACCESS_KEY` are
added and `ephemeral/<env>` is re-applied.

Per-environment secrets that can be added after base infra is running:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`
- `WORDPRESS_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`
- `DATABASE_URL_OWNER` (after Terraform creates the cluster)
- `JWKS_SNAPSHOT_KEY_TEST` or `JWKS_SNAPSHOT_KEY_PROD`

Onsite event pass / check-in (wired to `apps/api` via ephemeral Terraform):

- RSVP/pass HTML emails use **Postmark** on `apps/api` when `EMAIL_PROVIDER=postmark` (same `POSTMARK_SERVER_TOKEN` as worker/auth). No extra webhook secret.
- `CHECK_IN_TOKEN_SECRET` — optional; Terraform auto-generates a stable 48-char secret in state when omitted. Set explicitly (separate from `BETTER_AUTH_SECRET`) before LAX 001 so auth rotation does not break admin pass resend.

`INVITE_EMAIL_FROM` defaults in Terraform (`LAX Events <no-reply@mail.lax.bid>` prod, test variant on test). Override with `TF_VAR_invite_email_from` only if needed.

```sh
openssl rand -hex 24 | gh secret set CHECK_IN_TOKEN_SECRET --env prod
openssl rand -hex 24 | gh secret set CHECK_IN_TOKEN_SECRET --env test
```

Generate JWKS snapshot encryption keys:

```sh
openssl rand -base64 32 | gh secret set JWKS_SNAPSHOT_KEY_TEST --env test
openssl rand -base64 32 | gh secret set JWKS_SNAPSHOT_KEY_PROD --env prod
```

## 8. Verification

After bootstrap, these commands should succeed:

```sh
aws --endpoint-url "https://lon1.digitaloceanspaces.com" s3 ls "s3://${STATE_BUCKET_NAME}"
gh secret list
gh secret list --env test
gh secret list --env prod
```

## 9. Prebuilt images (DOCR) — faster App Platform deploys

By default App Platform builds **every** component from source on each deploy
(~30 min for this monorepo). Instead, GitHub Actions builds all six components
(`api`, `auth`, `ws`, `worker`, `migrate`, **`web`**) in parallel, pushes them to
**DigitalOcean Container Registry (DOCR)**, and App Platform only **pulls** them.

`web` bakes `NEXT_PUBLIC_*` at build time. Public values live in
[`infra/web-build/<env>.env`](../../web-build/README.md); GitHub vars/secrets supply
the rest (GTM, Turnstile site key, optional Sentry client DSN). CI validates that
`NEXT_PUBLIC_WEB_ORIGIN` matches the Terraform `local.web_origin` before every web
build.

The Terraform default is still `deploy_source = "github"` until you opt in via repo
variables. Everything below runs through **`Terraform apply {test,prod}`** and
**`App deploy {test,prod}`** — set GitHub **repository variables**; no local
`terraform` runs needed.

### 9.1 GitHub repository variables

Set these repo-level variables (not secrets, not `--env`). They are read by the
Terraform apply/plan workflows and by the deploy workflows. The `build-images`
job is gated in a reusable-workflow *caller* job, which cannot bind an
environment, so its `if:` only sees **repository/org** variables — environment
(`--env`) variables would be invisible there.

```sh
# Registry (account-level, created by the prod persistent apply)
gh variable set CREATE_CONTAINER_REGISTRY --body "true"
gh variable set DOCR_REGISTRY             --body "lax-bid"   # globally unique across DO
# Optional overrides (defaults shown): DOCR is NOT available in lon1.
# gh variable set DOCR_REGISTRY_REGION --body "fra1"          # nyc3|sfo3|ams3|sgp1|fra1
# gh variable set DOCR_REGISTRY_TIER   --body "professional"  # 'basic' caps at 5 repos (1 env only)

# Enable CI build+push per env
gh variable set USE_PREBUILT_IMAGES_TEST --body "true"
gh variable set USE_PREBUILT_IMAGES_PROD --body "true"

# Flip Terraform to pull images instead of building on DO, per env
gh variable set APP_DEPLOY_SOURCE_TEST --body "image"
gh variable set APP_DEPLOY_SOURCE_PROD --body "image"
```

Also confirm `DIGITALOCEAN_TOKEN` (from §1) has **read/write** scope — it is used
for `doctl registry login` and the image push.

**Web-only:** mirror the Terraform `NEXT_PUBLIC_SENTRY_DSN_WEB` value into a
per-environment GitHub secret (same DSN Sentry shows for `lax-<env>-web`):

```sh
gh secret set SENTRY_DSN_WEB --env test --body "<dsn>"
gh secret set SENTRY_DSN_WEB --env prod --body "<dsn>"
```

The account-level registry serves both envs; repos are created on first push and
named `lax-<env>-<component>` (e.g. `lax-prod-api`, `lax-prod-web`). Old
immutable `:<sha>` tags accumulate — run DOCR garbage collection periodically
(`doctl registry garbage-collection start`) to reclaim storage.

### 9.2 Bring-up order (must follow)

The App Platform `image` source fails to apply if the image does not yet exist,
so create the registry and build the images **before** flipping `APP_DEPLOY_SOURCE`.
Do **test fully first**, then repeat for prod.

1. Set `CREATE_CONTAINER_REGISTRY=true` + `DOCR_REGISTRY` (§9.1), then run
   **Actions → Terraform apply prod → layer: persistent** (creates the DOCR
   registry; account-level, prod state only).
2. Set `USE_PREBUILT_IMAGES_TEST=true` (and `_PROD` later). Trigger one build so
   every repo (including `lax-test-web`) has the `<env>` tag:
   **Actions → Build images → environment: test** (or
   `gh workflow run build-images.yml -f environment=test -f git_sha="$(git rev-parse HEAD)"`).
   Verify with `doctl registry repository list-v2`.
3. Set `APP_DEPLOY_SOURCE_TEST=image`, then run **Actions → Terraform apply test
   → layer: ephemeral** (rewrites the app spec to pull DOCR images for all
   components).
4. Push to `main` (or run **App deploy test**) and confirm App Platform *pulls*
   all six images (no source build in deploy logs).
5. Repeat 2–4 for prod: `USE_PREBUILT_IMAGES_PROD=true`, build images for prod,
   `APP_DEPLOY_SOURCE_PROD=image`, then **Terraform apply prod → ephemeral**
   (typed `APPLY-PROD` confirmation), then **App deploy prod**.

Note: the slim `migrate` image (`docker/migrate.Dockerfile`) takes effect on the
**next ephemeral apply regardless of the flags** — it's a safe standalone speedup.

6. Subsequent pushes: `build-images` pushes new `<env>` (and `<sha>`) tags in
   parallel with `sentry-release`, then the `deploy` job runs
   `doctl apps create-deployment`, which **always pulls and deploys a new image,
   even when the tag is unchanged**
   ([DO docs](https://docs.digitalocean.com/products/app-platform/how-to/deploy-from-container-images/)).
   No per-deploy `terraform apply` is needed; the spec keeps a stable `<env>` tag,
   so there is no Terraform drift.

   Residual-risk fallback: if image caching is ever observed (mutable-tag edge
   case), switch the deploy step to immutable digests via
   [`digitalocean/app_action/deploy@v2`](https://github.com/digitalocean/app_action)
   passing `IMAGE_TAG_<COMPONENT>=<sha>` (the unique `:<sha>` tag is already pushed).

### 9.3 Rollback

- App Platform console → one-click rollback to the previous deployment, or
- redeploy a known-good immutable tag: retag `lax-<env>-<comp>:<old-sha>` →
  `:<env>` in DOCR and run `doctl apps create-deployment`.
- To revert **web** (or all components) to DO source builds: set
  `APP_DEPLOY_SOURCE_<ENV>=github` (or restore per-component `deploy_source =
  "github"` in ephemeral Terraform) and re-apply ephemeral.
