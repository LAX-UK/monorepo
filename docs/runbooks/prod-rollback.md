# Production Terraform rollback

Use this only for infrastructure regressions. Database schema rollbacks are handled by the database migration process, not this runbook.

1. Identify the last known-good commit.
2. Run `terraform plan` for `persistent/prod` and `ephemeral/prod` at that commit.
3. Confirm the plan does not destroy Postgres, Redis, Spaces, or Cloudflare zone resources unless the incident commander explicitly approves.
4. Dispatch `terraform-apply-prod.yml` with `APPLY-PROD`.
5. Run the deploy checklist smoke tests from `docs/runbooks/deploy-checklist.md`.
