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

The repo never uses `-lock=false`, so this plan takes the normal state lock briefly. It
shares the `terraform-prod-ephemeral` concurrency group with prod apply, so it queues
behind a running apply rather than racing it for the lock.

## Reading the result

The job summary lists changed resources and the `Plan:` line; the full redacted text is the
`terraform-plan-prod-ephemeral` artifact (the binary plan is not uploaded: it can embed secrets).

Look for:
- **No changes** other than the image/tag updates you expect (web, api, ws, worker, migrate, shop*, account, art).
- Any `destroy` / `must be replaced`, especially databases, domains, DNS, WAF, Redis or Spaces: stop and investigate.
- App Platform env var changes you did not intend (a repo variable differing from prod reality).
- Unexpected changes unrelated to the release: that is drift, see `drift-remediation.md`.

## Weekly drift check

For prod the drift check resolves the live release SHA from `https://lax.bid/api/health/ready`
and passes it as an explicit `app_image_tag` (prod App Platform pins rolling tags like `prod`).
If the endpoint is down the job fails with an explicit error rather than the old "got prod".
