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

Create the Sentry organization and team used by Terraform:

- Organization slug: `lax`
- Team slug: `lax-engineering`

### Internal integration (terraform-bot)

In Sentry → **Settings → Developer Settings → Internal Integrations**, create
`terraform-bot` with scopes:

- `org:read`, `team:write`, `project:admin`, `project:releases`, `member:read`, `alerts:write`

Store the token:

```sh
gh secret set SENTRY_AUTH_TOKEN
```

Use an **Internal Integration** token (`terraform-bot`), not a personal user auth token.
The provider calls `GET https://sentry.io/api/0/` on startup; HTTP 401 means the secret
is missing, expired, or lacks the scopes above. After rotating the token, re-run
**Terraform apply test → layer: sentry**.

```sh
# Quick local check (paste token at prompt)
read -rs token; printf '%s' "$token" | tr -d '[:space:]' | \
  xargs -I{} curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -H "Authorization: Bearer {}" https://sentry.io/api/0/
```

### Third-party integrations (optional for first apply)

**Slack and PagerDuty alerts are deferred until you set the matching GitHub secrets.** With only `SENTRY_AUTH_TOKEN`, Terraform still creates projects, DSN keys, code mappings, and inbound filters — but skips issue/metric alerts.

When you are ready for Slack alerts:

1. Install **Slack** in Sentry → **Settings → Integrations** and connect `#alerts-engineering`.
2. Copy the Slack **channel ID** (`C…`) from the channel About tab.
3. Set `SENTRY_SLACK_CHANNEL_ID` on the `test` and/or `prod` GitHub environment.
4. Re-apply `infra/terraform/sentry/{env}` — alert rules are created on the next plan/apply.

For prod paging, also install **PagerDuty** in Sentry and set `PAGERDUTY_INTEGRATION_KEY` on the `prod` environment.

GitHub integration (for code mappings) is still required for the full stack:

- **GitHub** → link `LAX-UK/monorepo`

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

Legacy Sentry projects in `persistent/{env}` are migrated via controlled
`terraform state mv` (see `.cursor/plans/sentry_terraform_stack_17319c6f.plan.md`).

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
