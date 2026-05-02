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
`https://github.com/LAX-UK/monorepo.git` (see `repository_clone_url`).  
Creating the app calls the DigitalOcean API, which checks the **DigitalOcean
GitHub App**, not your API token. If you see  
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

Then add:

```sh
gh secret set SENTRY_AUTH_TOKEN
```

Sentry is optional for the first infrastructure bring-up. If
`SENTRY_AUTH_TOKEN` is absent or empty, Terraform skips Sentry project creation;
add the secret later and re-apply `persistent/test` and `persistent/prod` to
create the projects.

## 7. GitHub environments and secrets

Create GitHub Environments named `test` and `prod`. Required reviewers stay off
for now; production apply still requires the typed `APPLY-PROD` confirmation.

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
