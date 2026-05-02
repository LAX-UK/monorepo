# Your first PR

The first PR you ship should be small and visible end-to-end. Two patterns work well; pick whichever matches a real ticket on your queue.

## Pattern A — A new endpoint or service method

Suggested scope: a read-only HTTP endpoint that joins two existing tables and returns the result, or a new method on an existing service that adds a small calculation.

Where the work lives:

1. Service code: [apps/api/src/services/](../../apps/api/src/services/). Each service has an interface and an implementation. Add a method on the interface, implement it, write a Vitest unit test alongside.
2. HTTP handler: [apps/api/src/routes/](../../apps/api/src/routes/). Bind the new route, validate input via the [`packages/validators`](../../packages/validators/) Zod schemas, call the service, return JSON.
3. Container wiring: if you added a new service constructor parameter, update [apps/api/src/container.ts](../../apps/api/src/container.ts).

What good looks like: the diff is mostly tests; the handler is a thin pass-through; the service uses repository interfaces, not raw Drizzle calls.

## Pattern B — A new domain event type

If your task is "make X show up in Zoho", do it via a new domain event type, not a direct Zoho call.

1. Add the event type to the catalog in [docs/architecture/04-domain-events.md](../architecture/04-domain-events.md).
2. Update the producer service to call `domainEventPublisher.publish(tx, …)` inside an existing `db.transaction(...)` block. There must be **no** code path where the entity write commits without the event.
3. Update the relevant projector in [apps/worker/src/projectors/](../../apps/worker/src/projectors/) to handle the new event type. (Today the projectors are stubs — adding handler logic may be the first real Zoho/Xero outbound code.)

What good looks like: the producer change is a one-line addition inside an existing transaction; the consumer change is a `case` in a `switch`. No fan-out, no direct external calls, no out-of-band side effects.

## Review etiquette

- One PR, one concern. If you're tempted to "clean up while I'm in here", open a second PR.
- The architecture docs ship in the same PR as the code change if the change has architectural implications. The README is explicit about this.
- Reference D-numbers in PR descriptions when they apply (`Implements the producer side of D5 for user.email_verified`).
- Tag a reviewer who has shipped a similar change before; the team page in 1Password has the rotation.

## What not to do on a first PR

Don't touch [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) without a co-reviewer. Don't add a new Postgres role. Don't restructure the dependency-injection container. Don't add a new external integration without first proposing it as a D-decision.
