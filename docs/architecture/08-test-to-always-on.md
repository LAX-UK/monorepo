# Test-to-always-on migration

This is TF-P10: a placeholder for Strategy D when ephemeral test is no longer enough.

## Triggers

Switch test from on-demand ephemeral to always-on when any of these become true:

- A second human regularly uses test.
- An external tester needs to QA features.
- Automated end-to-end tests need to run on every PR.

## Target always-on shape

- Bundle web, api, and auth into one App Platform component.
- Keep ws separate.
- Keep worker separate.
- Keep Postgres `db-s-1vcpu-1gb`, 1 node, no HA.
- Keep Redis `db-s-1vcpu-1gb`.
- Retain the same Cloudflare WAF, TLS, and rate-limit posture as prod.

Expected steady-state test cost is roughly $60/month. The migration should be its own PR and should not change production sizing.
