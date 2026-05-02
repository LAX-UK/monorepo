# First day

The first-day checklist. The goal is that by the end of day one you have the codebase building locally, every credential you need, and a mental map of where things live.

## Accounts and access

Ask the founders to grant the following before you sit down:

- GitHub access to the `LAX-UK/monorepo` repo with `write` permission.
- DigitalOcean team access — read-only is sufficient for day one; you do not need App Platform admin.
- 1Password (or whatever the team currently uses) for shared secrets.
- Sentry team access.
- Cloudflare team access (read-only) so you can see DNS and WAF rules; admin is granted only on request.
- Slack workspace and the on-call channel.

You do not need direct access to Zoho EU, Xero, Shopify Partner, or the Apple/Google developer consoles on day one. Those are granted when you have a task that requires them.

## Tools

- Node 20+ via [nvm](https://github.com/nvm-sh/nvm) — `.nvmrc` pins the exact minor version.
- pnpm (the repo uses pnpm workspaces; npm and yarn will not work).
- Docker Desktop or an OCI-compatible runtime for local Postgres + Redis.
- VS Code or Cursor — both work; the repo's TypeScript settings assume the language server is one of those two.

## Repository tour

Top-level layout:

- [apps/](../../apps/) — five deployable apps (`web`, `api`, `auth`, `ws`, `worker`). Each is its own pnpm workspace with its own Dockerfile.
- [packages/](../../packages/) — shared workspaces. The ones you'll touch most are [`packages/db`](../../packages/db/) (Drizzle schema, migrations, repositories) and [`packages/auth`](../../packages/auth/) (better-auth wrapper).
- [docs/](../) — this directory. Architecture, runbooks, integrations, onboarding.
- [to-review/](../../to-review/) — temporary; deleted as part of the doc reorg this guide is part of.

Read in this order on day one: [docs/README.md](../README.md) → [docs/architecture/01-overview.md](../architecture/01-overview.md) → [docs/architecture/02-decisions.md](../architecture/02-decisions.md). That gets you the shape of the system and the eleven decisions that shape it.

## End-of-day checks

By the end of day one you should be able to answer:

- What are the three external domains, and which app serves which?
- Which of the eleven D-decisions is the highest-leverage one (D5/D8 — the outbox)?
- Where do JWT signing keys live, and which Postgres role can read them?

If any of those are foggy, re-read the architecture docs before moving on to [02-local-dev.md](./02-local-dev.md).
