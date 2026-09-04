# TheAlx documentation

This directory contains every architectural decision, runbook, and onboarding guide for the TheAlx auction platform. If you're new here, start with [first day](./onboarding/01-first-day.md). If you're debugging an incident, jump to [runbooks](./runbooks/). If you're trying to understand why something is built the way it is, read [architectural decisions](./architecture/02-decisions.md).

Documentation lives alongside code on purpose. Every change to the system that has architectural implications must be accompanied by a documentation change in the same PR. Stale docs are worse than no docs.

> Each architecture doc carries a top-of-file **Implementation status** block that distinguishes what is built today from what is scaffolded or planned. If the prose contradicts the status block, trust the status block.

## Architecture

Reference material — the system as it is, not as it was planned. Read these top to bottom on your first week.

- [Overview](./architecture/01-overview.md) — what the system does and what each deployable owns
- [Decisions](./architecture/02-decisions.md) — the numbered decision history, including superseded and retired decisions
- [Data model](./architecture/03-data-model.md) — every table, every relationship, every constraint that matters
- [Domain events](./architecture/04-domain-events.md) — how the outbox pattern works and why we have it
- [Identity flow](./architecture/05-identity-flow.md) — Identity and product RP/BFF flows
- [LAX Identity boundary](./architecture/09-lax-identity-boundary.md) — global Identity vs product profiles (D13)
- [Deployment](./architecture/06-deployment.md) — how the system is laid out on DigitalOcean, what runs where
- [Security model](./architecture/07-security-model.md) — trust boundaries, threat model, secrets handling

Diagrams referenced from these docs live in [architecture/diagrams](./architecture/diagrams/).

## Runbooks

Operational procedures for things that go wrong or need to happen on a schedule. Each runbook is a checklist — follow it top to bottom, do not improvise unless the runbook explicitly says to escalate.

- [JWKS rotation](./runbooks/jwks-rotation.md) — quarterly key rotation and emergency rotation on suspected leak
- [JWT key leak](./runbooks/jwt-key-leak.md) — incident response when the signing key is compromised
- [Zoho outage](./runbooks/incident-zoho-outage.md) — what to do when the Zoho EU API is down or rate-limiting us
- [Email provider incident](./runbooks/email-provider-incident.md) — Postmark outage / sender-reputation incident, including the `REQUIRE_EMAIL_VERIFICATION` kill-switch
- [Deletion request](./runbooks/deletion-request.md) — GDPR Article 17 manual procedure
- [Deploy checklist](./runbooks/deploy-checklist.md) — what to verify before, during, and after every production deploy
- [Saleroom clerk](./runbooks/saleroom-clerk.md) — paddle bidding and clerk console operations
- [Production rollback](./runbooks/prod-rollback.md) — Terraform-driven rollback for infrastructure regressions
- [Cost overrun](./runbooks/cost-overrun.md) — what to check when the monthly cost alert fires
- [Drift remediation](./runbooks/drift-remediation.md) — handling Terraform drift surfaced by the weekly workflow
- [State recovery](./runbooks/state-recovery.md) — restoring a previous Terraform state version from Spaces
- [On-call](./runbooks/on-call.md) — alert routing, escalation, and when to wake someone up
- [Bootstrap](./runbooks/bootstrap.md) — one-line pointer to the authoritative `infra/terraform/BOOTSTRAP.md`
- [Onboard a LAX product](./runbooks/onboard-lax-platform.md) — confidential client, BFF, resource, logout, and SSF checklist
- [SSF stream operations](./runbooks/ssf-stream-operations.md) — verify, enable, monitor, replay, rotate, and disable streams
- [Back-channel logout triage](./runbooks/backchannel-logout-triage.md) — diagnose issuer delivery and receiver invalidation

## Onboarding

For new engineers. Read in order, do the exercises, do not skip the first PR walkthrough.

- [First day](./onboarding/01-first-day.md) — accounts, access, tools, repository tour
- [Local dev](./onboarding/02-local-dev.md) — running the full stack locally including OAuth callback testing
- [First PR](./onboarding/03-first-pr.md) — walkthrough of an actual production PR from open to merge
- [Debugging](./onboarding/04-debugging.md) — where to look when something is wrong, common gotchas
- [Glossary](./onboarding/05-glossary.md) — terms, acronyms, what we mean when we say "projector" or "outbox"

## Security

- [Threat model](./security/threat-model.md) — pointer to the canonical security model in `architecture/07-security-model.md` plus a place for component-specific STRIDE walkthroughs
- [Secrets management](./security/secrets-management.md) — every secret in the system, where it lives, who can read it
- [Key rotation](./security/key-rotation.md) — JWKS rotation math (30-minute retirement window) referenced from D2 and the rotation runbook
- [Data deletion](./security/data-deletion.md) — GDPR Article 17 procedure referenced from the deletion-request runbook
- [Social login setup](./security/social-login-setup.md) — Google + Apple Sign-In configuration including Apple client-secret JWT generation
- [Data Processing Agreements](./security/dpas.md) — tracking sheet for processor agreements (Zoho, Xero, DigitalOcean, Cloudflare, Postmark)

## Design

- [Design system](./DESIGN_SYSTEM.md) — tokens, primitives, layout recipes, accessibility/SEO checklists
- [Forms conventions](./FORMS.md) — RHF + Zod + server-actions + `ActionResult` pattern for `apps/web`
- [Mockup parity](./design/mockup-parity.md) — deliberate supersets where the live UI ships richer behaviour than the static mockups
- [SEO structured data](./seo/structured-data.md) — JSON-LD payload catalogue per route
- [Saleroom data sources](./SALEROOM_DATA_SOURCES.md) — where the saleroom marketing UI text comes from

## Integrations

How each external system talks to TheAlx and what to configure on the external side.

- [Zoho](./integrations/zoho.md) — api-console.zoho.eu setup, scopes, refresh-token persistence
- [Email](./integrations/email.md) — Postmark transactional/notification + Zoho Campaigns one-way newsletter push, sender domain setup, suppression and unsubscribe semantics
- [Marketing contacts (Brevo)](./integrations/marketing-contacts.md) — interim registered-user sync to Brevo for lifecycle campaigns (`news.lax.bid`), webhook opt-outs
- [Cloudflare](./integrations/cloudflare.md) — DNS records, page rules, WAF rules, full-strict TLS
- [DigitalOcean](./integrations/digitalocean.md) — App Platform components, managed Postgres, migration job

## Auction-domain reference

- [System analysis](./SYSTEM_ANALYSIS.md) — current auction-domain runtime (sales, lots, bids, payments, Xero)
- [Sale delivery modes](./SALE_DELIVERY_MODES.md) — online vs hybrid vs onsite (capability map reference)
- [V1 product spec](./V1_PRODUCT_SPEC.md) — the V1 role model, auction strategy scope, and acceptance criteria
- [Diagrams](./DIAGRAMS.md) — system, ERD, lifecycle, bid-placement, realtime, payment, public API
- [OpenAPI](./openapi.yaml) — REST surface for `apps/api`
- [Load testing outline](./LOAD_TESTING.md) — k6/Artillery scenarios for bidding, anti-sniping, Dutch acceptance, payments

## Conventions

A few rules that apply across all docs:

The [engineering standards index](./engineering-standards.md) links the
repository-wide SOLID, scalability, test-pyramid, and release-evidence contract
([quality standard](./engineering/quality-standard.md)), architecture SSOTs, and
enforcement scripts. Domain-specific documents remain the source of truth for
detailed boundaries.

Architectural decisions are referenced by D-number. Superseded or retired
entries remain as history and link to the current decision.

Risks are referenced by R-number (R1–R5). Implementation revisions made during planning are referenced by F-number (F1–F10) and M-number (M1–M2). Entry-gate decisions are G1–G4. These numbers never change.

Diagrams are versioned. When the system changes, a new version of the affected diagram is created in [architecture/diagrams](./architecture/diagrams/) — old versions are not deleted, they're moved to `diagrams/archive/` so historical PRs still render.

Code paths in docs use the form `apps/api/src/services/bid.service.ts` — always full path from repo root, never partial. Click-throughs in editors work correctly only with full paths.

## When to update what

| Change | Update |
|---|---|
| Sale delivery mode behavior | Update `SALE_DELIVERY_MODES.md` and `packages/validators/src/sale-mode-policy.ts` |
| New external integration | Add `integrations/<name>.md`, link from this README |
| New database table | Update `architecture/03-data-model.md` and the ERD diagram, plus the role-grant lists in `packages/db/src/migrate-roles.ts` |
| New domain event type | Update `architecture/04-domain-events.md` event catalog |
| New email template | Add to `packages/email/src/templates/`, register in `types.ts` (`TemplateName`, `TemplateVarsByName`, `RECIPIENT_RESOLUTION`); see `architecture/04-domain-events.md → "Adding a new email template"` |
| New BullMQ queue | Update `architecture/06-deployment.md` (worker section), wire health-check heartbeats |
| New runbook needed | Add to `runbooks/`, link from this README |
| New trust boundary or threat | Update `architecture/07-security-model.md` (boundary diagram + threat catalog) |
| Decision change or new decision | Add new D-number to `architecture/02-decisions.md`, never edit existing |
| Secret added | Update `security/secrets-management.md` |
| New onboarding gotcha | Add to `onboarding/04-debugging.md` |

## Where this lives

This documentation is in the same monorepo as the code at `docs/`. It ships with every deploy. The Cursor AI assistant indexes these files when answering architectural questions. Treat them as code: review changes, keep them current, delete what's wrong.
