# Production Terraform plan (read-only, pre-release)

`terraform-plan.yml` only runs `init -backend=false` + `validate` for prod. To see what a
release would change in production, dispatch **Terraform plan prod** instead. It runs
`terraform plan` for `terraform/ephemeral/prod` against the real backend and never applies
(no apply step, no `-auto-approve`).

## Dispatch

Actions → *Terraform plan prod* → Run workflow:

| Input | Value |
| --- | --- |
| `app_image_tag` | Required. 40-char lowercase SHA you intend to release (the same value you would pass to *Terraform apply prod*). |
| `app_git_branch` | Defaults to `release`, as in apply. |
| `infra_ref` | auction-infra ref; defaults to `main`. |

The job uses the `prod` environment, so it waits for the environment's reviewers.

## Locking

The repo never uses `-lock=false`, so this plan takes the normal state lock. It has its own
concurrency group (`terraform-plan-prod-ephemeral`), so a plan can never replace a queued prod
apply, and it waits up to 5 minutes (`-lock-timeout=5m`) for a running apply to release the lock.

## Reading the result

The job summary lists changed resources and the `Plan:` line; the full redacted text is the
`terraform-plan-prod-ephemeral` artifact (the binary plan is not uploaded: it can embed secrets).

Look for:
- **No changes** other than the image/tag updates you expect (web, api, ws, worker, migrate, shop*, account, art).
- Any `destroy` / `must be replaced`, especially databases, domains, DNS, WAF, Redis or Spaces: stop and investigate.
- App Platform env var changes you did not intend (a repo variable differing from prod reality).
- Unexpected changes unrelated to the release: that is drift, see `drift-remediation.md`.

## Weekly drift check

For prod the drift check reads the live release SHA from `https://lax.bid/api/health/ready` and
passes it as `app_image_tag`, which pins only the five monorepo components (web, api, ws, worker,
migrate). shop, shop-api, shop-admin, shop-identity, account and art release separately, so they keep
the SHA from the live App Platform spec; the check still fails if one of them is on a rolling tag.
If readiness is unavailable (planned maintenance or an outage) the prod ephemeral check is skipped
with a warning and a job-summary note instead of reporting false drift. A 200 answer without a
40-character release SHA fails the job.
