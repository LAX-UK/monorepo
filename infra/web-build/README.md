# Web Docker build args (CI → DOCR)

The `apps/web` Next.js app inlines `NEXT_PUBLIC_*` values at **build time**. When App
Platform pulls a prebuilt image from DOCR, those values must already be baked into
the image — they cannot be supplied only at runtime.

## Sources of truth

| Value | Source | Notes |
|---|---|---|
| Public URLs, `NEXT_PUBLIC_WEB_ORIGIN`, indexing flags | `<env>.env` in this directory | Must mirror `web_origin`, `api_public_url`, etc. in `infra/terraform/ephemeral/<env>/main.tf` |
| GTM, consent banner, CSP report URI, CSP enforce | GitHub **repository/environment variables** | Same names as Terraform `TF_VAR_*` inputs |
| Turnstile site key | GitHub secret `TURNSTILE_SITE_KEY` (repo) | Public site key; secret key stays server-side only |
| Sentry client DSN | GitHub secret `SENTRY_DSN_WEB` (per env) | Same DSN Terraform binds as `NEXT_PUBLIC_SENTRY_DSN_WEB`; required for client error reporting in prebuilt images |
| Sentry release | CI git SHA | Passed as `SENTRY_RELEASE` at build time |

CI validates that `NEXT_PUBLIC_WEB_ORIGIN` in `<env>.env` equals the Terraform
`local.web_origin` before every web image build (`scripts/ci/web-build-args.sh
verify-origin`). The same check runs on every PR in the main CI workflow.

## Changing a value

1. Update `<env>.env` (for committed public values) and/or the GitHub var/secret.
2. If the Terraform local changed too, update `<env>.env` to match.
3. Push to the deploy branch (`main` for test, `release` for prod). The deploy
   workflow rebuilds all six DOCR images (including web) when `infra/web-build/**`
   or `apps/**` changes.

No Terraform apply is needed for build-arg-only changes — only a new image build
and `doctl apps create-deployment`.

## Rollback

Redeploy a known-good immutable SHA tag from DOCR, or use App Platform one-click
rollback. To revert web to DO source builds, restore `deploy_source = "github"` on
the web component and re-apply ephemeral Terraform.
