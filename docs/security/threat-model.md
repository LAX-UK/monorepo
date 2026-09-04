# Threat model

The full threat catalog with trust boundaries, threat-and-mitigation pairs, accepted risks, and what's explicitly out of scope lives in [../architecture/07-security-model.md](../architecture/07-security-model.md). That document is the canonical security model.

This file exists for two reasons:

1. The README points at `security/threat-model.md` because it's a more discoverable name than `architecture/07-security-model.md` for someone looking for "the threat model".
2. As a place to record any threat-modeling artifacts that are component-specific or activity-specific (post-incident threat updates, third-party penetration test reports, STRIDE walkthroughs of new components). Today there are none — when we generate them, they go here.

## Where to look

- **Trust boundaries diagram + canonical threat catalog:** [../architecture/07-security-model.md](../architecture/07-security-model.md).
- **Architectural decisions that shape the threat model:** [../architecture/02-decisions.md](../architecture/02-decisions.md), particularly D2 (role split), D6 (provider verification), D9 (issuer URL), D14–D16 (resource tokens, host-only BFF sessions, logout/SSF), and D18 (subject type).
- **Secrets inventory:** [./secrets-management.md](./secrets-management.md).
- **DPA tracking with processors:** [./dpas.md](./dpas.md).
- **Incident-response runbooks:** [../runbooks/jwt-key-leak.md](../runbooks/jwt-key-leak.md), [../runbooks/jwks-rotation.md](../runbooks/jwks-rotation.md).

## STRIDE walkthroughs (per component)

A STRIDE pass on each app is **(planned)**. Add one here per app the first time you do a meaningful security review of that component. Format suggestion:

```
### apps/<name> — reviewed YYYY-MM-DD by <reviewer>

S (Spoofing): …
T (Tampering): …
R (Repudiation): …
I (Information disclosure): …
D (Denial of service): …
E (Elevation of privilege): …

Net: <accepted | mitigated | open>
```

When the threat surface materially changes (a new external integration, a new auth flow, a new role grant), schedule a fresh STRIDE pass on the affected component and append a new entry.
