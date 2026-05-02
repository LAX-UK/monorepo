# Cost overrun runbook

The default monthly alert threshold is $400.

1. Run `pnpm test:down` or dispatch `terraform-test-down.yml` to destroy ephemeral test.
2. Check DigitalOcean managed database sizes against `infra/terraform/ephemeral/*/main.tf`.
3. Confirm App Platform instance counts match the intended environment sizing.
4. If production spend is still high, manually scale the worker to one instance and open a Terraform PR that makes the same change.
5. If the cause is drift, follow `docs/runbooks/drift-remediation.md`.

Never reduce WAF, TLS, or rate-limit controls to save cost.
