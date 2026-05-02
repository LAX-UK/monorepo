# Terraform infrastructure

This tree manages the greenfield `lax.bid` infrastructure on DigitalOcean and Cloudflare.

## Layers

- `persistent/`: resources that survive teardown, including DNS, projects, Sentry projects, and the shared `lax-media` Space.
- `ephemeral/`: resources that can be destroyed and rebuilt, including Postgres, Redis, App Platform, monitoring, and app runtime wiring.
- `bootstrap/`: manual preparation only. Read `BOOTSTRAP.md` before the first apply.

Apply order:

1. Complete `BOOTSTRAP.md`.
2. Apply `persistent/prod`.
3. Apply `persistent/test`.
4. Apply `ephemeral/test`.
5. After test has run for 24 hours, apply `ephemeral/prod`.

State lives in DigitalOcean Spaces. DigitalOcean Spaces does not provide native Terraform state locking, so applies must run through GitHub Actions. Do not run `terraform apply` locally except during documented state recovery.

Resource names use `lax-<env>-<purpose>`. Every taggable resource carries `environment` and `managed_by=terraform`. Modules never hard-code environment names.
