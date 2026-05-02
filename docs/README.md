# TheAlx documentation

This directory contains every architectural decision, runbook, and onboarding guide for the TheAlx auction platform. If you're new here, start with [first day](./onboarding/01-first-day.md). If you're debugging an incident, jump to [runbooks](./runbooks/). If you're trying to understand why something is built the way it is, read [architectural decisions](./architecture/02-decisions.md).

Documentation lives alongside code on purpose. Every change to the system that has architectural implications must be accompanied by a documentation change in the same PR. Stale docs are worse than no docs.

> Each architecture doc carries a top-of-file **Implementation status** block that distinguishes what is built today from what is scaffolded or planned. If the prose contradicts the status block, trust the status block.

## Architecture

Reference material — the system as it is, not as it was planned. Read these top to bottom on your first week.

- [Overview](./architecture/01-overview.md) — what the system does, what the three apps own, what's deliberately not in scope
- [Decisions](./architecture/02-decisions.md) — the eleven architectural decisions (D1–D11) with alternatives considered and rationale
- [Data model](./architecture/03-data-model.md) — every table, every relationship, every constraint that matters
- [Domain events](./architecture/04-domain-events.md) — how the outbox pattern works and why we have it
- [Identity flow](./architecture/05-identity-flow.md) — what happens when a user signs in across three domains
- [Deployment](./architecture/06-deployment.md) — how the system is laid out on DigitalOcean, what runs where
- [Security model](./architecture/07-security-model.md) — trust boundaries, threat model, secrets handling

Diagrams referenced from these docs live in [architecture/diagrams](./architecture/diagrams/).

## Runbooks

Operational procedures for things that go wrong or need to happen on a schedule. Each runbook is a checklist — follow it top to bottom, do not improvise unless the runbook explicitly says to escalate.

- [JWKS rotation](./runbooks/jwks-rotation.md) — quarterly key rotation and emergency rotation on suspected leak
- [JWT key leak](./runbooks/jwt-key-leak.md) — incident response when the signing key is compromised
- [Zoho outage](./runbooks/incident-zoho-outage.md) — what to do when the Zoho EU API is down or rate-limiting us
- [Deletion request](./runbooks/deletion-request.md) — GDPR Article 17 manual procedure
- [Deploy checklist](./runbooks/deploy-checklist.md) — what to verify before, during, and after every production deploy
- [On-call](./runbooks/on-call.md) — alert routing, escalation, and when to wake someone up

## Onboarding

For new engineers. Read in order, do the exercises, do not skip the first PR walkthrough.

- [First day](./onboarding/01-first-day.md) — accounts, access, tools, repository tour
- [Local dev](./onboarding/02-local-dev.md) — running the full stack locally including OAuth callback testing
- [First PR](./onboarding/03-first-pr.md) — walkthrough of an actual production PR from open to merge
- [Debugging](./onboarding/04-debugging.md) — where to look when something is wrong, common gotchas
- [Glossary](./onboarding/05-glossary.md) — terms, acronyms, what we mean when we say "projector" or "outbox"

## Security

- [Threat model](./security/threat-model.md) — STRIDE analysis per component, what we defend against and what we accept
- [Secrets management](./security/secrets-management.md) — every secret in the system, where it lives, who can read it
- [Data Processing Agreements](./security/dpas.md) — tracking sheet for processor agreements (Zoho, Shopify, Xero, DigitalOcean, Cloudflare)

## Integrations

How each external system talks to TheAlx and what to configure on the external side.

- [WordPress](./integrations/wordpress.md) — OpenID Connect Generic plugin setup on thealx.art
- [Shopify](./integrations/shopify.md) — non-Plus webhook subscriptions including mandatory GDPR webhooks
- [Zoho](./integrations/zoho.md) — api-console.zoho.eu setup, scopes, refresh-token persistence
- [Cloudflare](./integrations/cloudflare.md) — DNS records, page rules, WAF rules, full-strict TLS
- [DigitalOcean](./integrations/digitalocean.md) — App Platform components, managed Postgres, migration job

## Conventions

A few rules that apply across all docs:

Architectural decisions are referenced by their D-number (D1, D2, ..., D11). When you see "per D8" in a doc or runbook, that means "the decision recorded in [02-decisions.md](./architecture/02-decisions.md) section D8." Decisions never change in place — when we revise one, we add a new D-number with a "supersedes Dn" header. The original stays so we have history.

Risks are referenced by R-number (R1–R5). Implementation revisions made during planning are referenced by F-number (F1–F10) and M-number (M1–M2). Entry-gate decisions are G1–G4. These numbers never change.

Diagrams are versioned. When the system changes, a new version of the affected diagram is created in [architecture/diagrams](./architecture/diagrams/) — old versions are not deleted, they're moved to `diagrams/archive/` so historical PRs still render.

Code paths in docs use the form `apps/api/src/services/bid.service.ts` — always full path from repo root, never partial. Click-throughs in editors work correctly only with full paths.

## When to update what

| Change | Update |
|---|---|
| New external integration | Add `integrations/<name>.md`, link from this README |
| New database table | Update `architecture/03-data-model.md` and the ERD diagram |
| New domain event type | Update `architecture/04-domain-events.md` event catalog |
| New runbook needed | Add to `runbooks/`, link from this README |
| Decision change or new decision | Add new D-number to `architecture/02-decisions.md`, never edit existing |
| Secret added | Update `security/secrets-management.md` |
| New onboarding gotcha | Add to `onboarding/04-debugging.md` |

## Where this lives

This documentation is in the same monorepo as the code at `docs/`. It ships with every deploy. The Cursor AI assistant indexes these files when answering architectural questions. Treat them as code: review changes, keep them current, delete what's wrong.
