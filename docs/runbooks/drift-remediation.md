# Terraform drift remediation

The weekly drift workflow opens issues tagged `drift-detected`.

1. Read the workflow logs and identify the resource address with drift.
2. If the console change is intentional, capture it in Terraform and close the issue from the PR.
3. If it is accidental, revert it in the console or run the matching Terraform apply.
4. Never ignore drift on state, DNS, WAF, database size, or App Platform env vars.

For state corruption or impossible plans, use `docs/runbooks/state-recovery.md`.
