# Domain events

The domain events outbox is the single most important pattern in this architecture (D5). Every meaningful business action in the system — a user registering, a bid being placed, a payment captured — is recorded as a row in the `domain_events` table in the same database transaction as the entity it describes. A separate worker process polls that table and dispatches each event to every projector that subscribes to it. Projectors transform events into the shape an external system expects and call that system's API.

This single pattern gives us four properties that would otherwise require significant additional infrastructure: a complete audit log, replayability per integration, zero coupling between business logic and external services, and a foundation for any future event consumer without changes to application code.

> **Implementation status (last reviewed 2026-05-05).** The contract described in this document is **only partially implemented**.
>
> - **Implemented:** `domain_events` and `projector_state` tables with all the columns referenced below ([packages/db/src/schema/domain-events.ts](../../packages/db/src/schema/domain-events.ts)). `DomainEventPublisher.publish(tx, event)` ([apps/api/src/services/domain-event.publisher.ts](../../apps/api/src/services/domain-event.publisher.ts)). The `FOR UPDATE SKIP LOCKED` polling runner ([apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts)).
> - **Scaffolded but not wired:** the Zoho and Xero projectors exist as pure mapping helpers ([apps/worker/src/projectors/zoho.ts](../../apps/worker/src/projectors/zoho.ts), [apps/worker/src/projectors/xero.ts](../../apps/worker/src/projectors/xero.ts)) but the runner does not import them; the `ZohoClient` is a no-op stub. The runner advances only the `zoho` cursor — the `xero` row in `projector_state` is created at startup but never updated.
> - **Not yet wired:** **no service in `apps/api` calls `DomainEventPublisher.publish`** — registration, bid, and payment paths emit no events today. The event catalog below is the contract those services are being changed to satisfy, not a description of live traffic.
>
> The shape of the rest of this document is the design that the **(Phase 2)** wiring work is targeting; treat the catalog and runner SQL as authoritative for the schema, and the prose about projectors as the contract those projectors will satisfy once the outbound HTTP work lands.

## The flow at a glance

```mermaid
flowchart LR
  A[Application code]
  B[(domain_events)]
  C[Projector runner]
  D[Zoho projector]
  E[Xero projector]
  F[Future projector]
  G[Zoho CRM]
  H[Xero]
  I[X]

  A -->|same DB tx| B
  B -->|FOR UPDATE SKIP LOCKED| C
  C --> D
  C --> E
  C --> F
  D --> G
  E --> H
  F --> I

  style A fill:#EEEDFE,stroke:#534AB7,color:#3C3489
  style B fill:#FAEEDA,stroke:#854F0B,color:#633806
  style C fill:#E1F5EE,stroke:#0F6E56,color:#085041
  style D fill:#FAECE7,stroke:#993C1D,color:#712B13
  style E fill:#FAECE7,stroke:#993C1D,color:#712B13
  style F fill:#F1EFE8,stroke:#5F5E5A,color:#444441
  style G fill:#EAF3DE,stroke:#3B6D11,color:#27500A
  style H fill:#EAF3DE,stroke:#3B6D11,color:#27500A
  style I fill:#F1EFE8,stroke:#5F5E5A,color:#444441
```

The application code on the left writes both the entity and the event in one transaction, so there is no scenario where one commits without the other. The `domain_events` table is the durable handoff. The runner in `apps/worker` polls with `FOR UPDATE SKIP LOCKED` so multiple worker instances cannot double-process the same row. Each projector has its own cursor in `projector_state`, so a slow Zoho projector cannot block a fast Xero projector — once the Xero cursor is actually advanced by the runner, which is **(Phase 2)**.

## Why this pattern over the alternatives

The decision in D5 documents the alternatives we rejected, but the reasoning is worth understanding deeply because every engineer who works on this system will at some point ask "why don't we just call Zoho directly?"

**Direct synchronous HTTP call from the request handler.** The user signs up, the request handler calls Zoho's API, returns to the user. This adds Zoho's latency to every signup (Zoho EU is fast but not instant), introduces a failure mode where a Zoho outage causes user-visible signup errors, and creates timing-dependent test flakiness. More importantly, it tightly couples the signup code to Zoho — adding a second integration (Xero, MailChimp, Slack) means modifying the signup code path. That coupling compounds with every new integration.

**Fire-and-forget queue jobs without an outbox.** Application code commits the entity, then enqueues a BullMQ job to call Zoho. This is the obvious next step from synchronous calls, and it's where most architectures stop. The problem is the gap between commit and enqueue: if the worker process crashes, gets killed, or runs out of memory between the two operations, the entity is committed but the job is lost forever. Silently. There's no audit trail saying "this user registered but we never told Zoho." For a CRM integration, eventual consistency is fine — silent loss is not.

**CDC tail of the Postgres write-ahead log.** Tools like Debezium can stream row changes from the WAL into Kafka, and downstream consumers project from Kafka. This is the pattern at hyperscale. It's beautiful at scale and operationally heavy below scale: Debezium needs a Kafka cluster to connect to, Kafka needs ZooKeeper or KRaft, you need consumer groups, you need monitoring for replication lag. Three pieces of infrastructure to add for a problem that a Postgres table solves directly.

**The outbox.** A row is written in the same transaction as the entity, so atomicity is guaranteed by Postgres. The runner reads from a single table with a cursor, so the operational model is "watch this number go up." Adding a projector is one new file. Replaying a projector is one SQL update. Crash recovery is automatic — the worker restarts, reads its cursor, picks up where it left off. The cost is a polling delay (1.5 seconds typical) which is irrelevant for CRM-shaped use cases.

The pattern's only meaningful cost is the discipline required to never bypass it. Anyone writing application code that calls Zoho directly defeats the entire architecture. Code review must reject any direct integration call from outside `apps/worker/src/projectors/`.

## Payload PII policy

**Principle.** Stored `domain_events.payload` JSON may contain sensitive attributes for downstream projectors and accounting. Anything **exported** to humans (CSV/JSON admin download, structured logs in worker projectors) must minimise PII by default: recursive redaction with a **default-deny** posture for string leaves, while retaining obvious reference fields (`*Id`, monetary amounts, ISO timestamps, status enums).

**Snake_case reference keys (2026-05-07).** The redaction helper also treats leaf keys ending in `_id` (for example `target_legal_entity_id`) as non-PII references, mirroring the existing `*Id` camelCase rule so JSON payloads that use snake_case remain usable in exports without enumerating every key.

**Implementation.** `redactDomainEventPayload(eventType, payload, { includePii })` ships in `@auction/types` ([packages/types/src/domain-event-pii.ts](../../packages/types/src/domain-event-pii.ts)). The worker re-exports it from [apps/worker/src/projectors/lib/redact-pii.ts](../../apps/worker/src/projectors/lib/redact-pii.ts) for projector logging. Admin export: `GET /admin/audit/domain-events/export` applies the helper unless the caller passes `includePii=1` **and** holds the `audit.read_pii` capability (administrator-only today).

**Documented exceptions** (these event types retain named PII fields when not using `includePii`):

| Event type | Allowed PII paths |
|---|---|
| `legal_entity.member_invited` | `email`, `inviteeEmail`, `invitedEmail` |
| `payment.captured` | `buyerName`, `buyerEmail`, `buyer.name`, `buyer.email`, `email`, `name` |
| `kyc.verified` | `firstName`, `lastName`, `dateOfBirth`, and under `verified.*` the identity document subset listed in code (`firstName`, `lastName`, `dateOfBirth`, `fullName`, `nationality`, `documentType`, `documentCountry`, `documentExpiry`) |
| `legal_entity.docs_requested` | `from_status`, `to_status`, `reason` (operational audit text) |
| `legal_entity.review_started` | `from_status`, `to_status`, `reason` |
| `legal_entity.approved` | `from_status`, `to_status`, `reason` |
| `legal_entity.restricted` | `from_status`, `to_status`, `reason` |
| `legal_entity.rejected` | `from_status`, `to_status`, `reason` |
| `legal_entity.archived` | `from_status`, `to_status`, `reason` |

When adding a new event type that must carry PII for a lawful purpose, update this table **and** the allowlist in `domain-event-pii.ts` in the same PR.

## Event catalog

This catalog is the contract between event producers and projectors. When you add a new event type, add it here. When you change a payload schema, bump the `schema_version` and document the change. When you add a new projector that consumes an existing event, add a new row to the consumers column.

> **Status note.** None of the events listed below are currently emitted by the application — wiring them up is **(Phase 2)**. The catalog is the contract `apps/api` services and the `apps/worker` projectors are being changed to satisfy.

| Event type | Producer | Consumers | Triggered by | Payload (v1) |
|---|---|---|---|---|
| `user.registered` | apps/api or apps/auth | zoho | New user row created | `{userId, email, name, source: 'credential'\|'google'\|'apple'}` |
| `user.email_verified` | apps/auth | zoho | Email verification token redeemed | `{userId, email, verifiedAt}` |
| `user.linked_external` | apps/api | zoho | external_accounts row written | `{userId, provider, externalId, linkedAt}` |
| `bid.first_for_user` | apps/api | zoho | First bid by this user on this lot | `{bidId, lotId, userId, amountCents, placedAt}` |
| `bid.outbid` | apps/api | zoho, notifications | This user's bid was exceeded | `{previousBidId, lotId, userId, newHighAmountCents}` |
| `bid.lot_won` | apps/worker (lot lifecycle) | zoho, notifications | Lot ended with this user as high bidder | `{lotId, userId, winningBidId, amountCents, endedAt}` |
| `payment.captured` | apps/api | xero, zoho | Stripe payment intent transitions to captured | `{paymentId, lotId, userId, amountCents, capturedAt, stripeIntentId}` |
| `payment.refunded` | apps/api | xero, zoho | Refund processed | `{paymentId, lotId, userId, amountCents, refundedAt, reason}` |
| `lot.activated` | apps/api (lot lifecycle service) | notification-fanout (planned) | Lot start time reached or saleroom open | `{saleId, activatedAt}` |
| `lot.created` | apps/api | lot_lifecycle_snapshot projector | Staff create, sale addLot, submission approve | `{saleId, source}` |
| `lot.attached_to_sale` | apps/api | lot_lifecycle_snapshot projector | attach endpoint, sale patch, wizard attach | `{saleId, lotNumber, fromSaleId, via}` |
| `lot.detached_from_sale` | apps/api | lot_lifecycle_snapshot projector | detach endpoint or saleId cleared via patch | `{fromSaleId}` |
| `lot.published` | apps/api | lot_lifecycle_snapshot projector | Lot or sale publish cascade | `{saleId}` |
| `lot.unpublished` | apps/api | lot_lifecycle_snapshot projector | Sale unpublish cascade or manual | `{saleId, reason}` |
| `lot.cancelled` | apps/api | lot_lifecycle_snapshot projector | Manual, sale cancel, soft delete, withdrawal | `{reason}` |
| `lot.ended` | apps/api / apps/worker | zoho (hadWinner), notification-fanout | Timed close, clerk hammer/no-sale, early close, admin override | `{outcome, winnerId, saleId, trigger, hammerPrice?, hadWinner?, endedAt?}` |
| `lot.voided` | apps/api | lot-voided-anti-shilling worker | Anti-shilling at close | `{reason}` |
| `lot.withdrawal_requested` | apps/api | lot_lifecycle_snapshot projector | Seller withdrawal task opened | `{sellerLegalEntityId}` |
| `lot.returned_to_inventory` | apps/api | lot_lifecycle_snapshot projector | Staff return-to-inventory transition | `{fromStatus, lastSaleId, reason}` |

Admin bulk operations added in the dashboard UX pass are synchronous admin APIs,
not domain-event producers today:

- `POST /admin/users/bulk` (`suspend`, `unsuspend`) loops through the existing
  suspension service path and returns the first service error.
- `POST /admin/invitations/bulk` (`revoke`, `resend`) loops through existing
  invitation service methods so invitation email behaviour stays unchanged.
- `POST /admin/email/suppressions/bulk` (`delete`) removes suppression rows by
  email hash through the observability repository.
- `POST /submissions/bulk` (`approve`, `reject`) loops through the existing
  submission review service methods; approval still creates draft lots through
  the normal conversion path.

If these operations later need audit replay or outbound integrations, add
explicit `admin.bulk_*` event types here before wiring projector consumers.

Bid emissions are deliberately limited to milestones per Q14 to keep Zoho rate-limit headroom. Every individual bid is a row in the `bid` table; only first-bid-for-this-user-on-this-lot, outbid, and won-the-lot are domain events. Hot lots can take 100+ bids per minute and we never want that volume hitting Zoho.

## Producing an event

Every event is produced inside an existing database transaction. The `DomainEventPublisher` is a thin service-layer class that takes a transaction handle and an event spec.

```typescript
import { DomainEventPublisher } from "./services/domain-event.publisher";

await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({ email, name })
    .returning();

  await tx.insert(externalAccounts).values({
    userId: user.id,
    provider: "google",
    externalId: googleSub,
    email,
    linkedAt: new Date(),
  });

  await publisher.publish(tx, {
    aggregateType: "user",
    aggregateId: user.id,
    eventType: "user.registered",
    payload: { userId: user.id, email, name, source: "google" },
    correlationId: ctx.correlationId,
    actorUserId: null,
  });
});
```

The publisher's `publish` method requires a transaction handle as its first argument specifically to make it hard to misuse. There is no `publish(event)` overload — every call must be inside an existing transaction. If the entity write rolls back, the event row rolls back too.

Code review rule: any service method that emits a domain event must take its database handle as a constructor or function argument. No service should grab a global `db` instance and start its own transaction independently of the caller — that defeats the same-transaction invariant.

## Consuming events: projectors

A projector is a class with a single `process(event)` method. The runner in [apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts) polls `domain_events`, dispatches each event to every interested projector, advances each projector's cursor on success, and records errors on failure.

> **Status note.** Today the runner advances only the `zoho` cursor and logs each event without dispatching to a projector class. The Zoho and Xero projectors live as pure mapping functions in [apps/worker/src/projectors/zoho.ts](../../apps/worker/src/projectors/zoho.ts) and [apps/worker/src/projectors/xero.ts](../../apps/worker/src/projectors/xero.ts) but are not imported by the runner. The class-based shape below is the target.

```typescript
export class ZohoProjector implements IProjector {
  readonly name = "zoho";

  async process(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case "user.registered":
        return this.upsertContact(event.payload as UserRegisteredPayload);
      case "bid.lot_won":
        return this.createDeal(event.payload as BidLotWonPayload);
      case "payment.captured":
        return this.attachInvoice(event.payload as PaymentCapturedPayload);
      default:
        return;
    }
  }
}
```

The projector decides what to do with each event type. It does not need to handle every event — events it doesn't recognize are ignored (the runner advances the cursor regardless). Adding a new event type does not require modifying any existing projector unless that projector wants to consume it.

A projector is allowed to fail. The runner catches errors, records them on `projector_state.last_error`, and retries on the next poll. If a projector keeps failing, the BullMQ retry schedule applies (1s, 5s, 30s, 5min, 30min) with a circuit breaker after 5 consecutive failures (R2). Failed jobs land in a dead-letter queue and trigger a Sentry alert. Operationally, projector lag is monitored — if Zoho's projector cursor falls more than five minutes behind the latest event, page on-call.

## The polling query

The runner's polling loop is the most performance-critical path in the worker. It uses `FOR UPDATE SKIP LOCKED` per F4 so multiple worker instances do not contend for the same rows.

```sql
BEGIN;

SELECT * FROM domain_events
WHERE id > (SELECT last_processed_event_id FROM projector_state WHERE projector_name = $1)
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;

-- runner dispatches each row to the projector in TypeScript

UPDATE projector_state
SET last_processed_event_id = $maxId, updated_at = now()
WHERE projector_name = $1;

COMMIT;
```

The lock is held for the duration of the transaction, which spans dispatching every row in the batch. If a projector takes a long time to process an event (Zoho API call), the lock stays held — but that's fine because it's only blocking other instances of the same projector from picking up those specific rows. Other projectors are unaffected, they have their own cursors.

The `SKIP LOCKED` clause is what makes this safe at any worker count. Two worker instances of the Zoho projector polling simultaneously will each take a different batch of 100 rows, no overlap, no manual coordination. Zero application-code changes needed when scaling from 1 worker to N.

The 100-row batch size is a tuning knob. Larger batches mean fewer round-trips to Postgres but longer-held locks; smaller batches mean more polling overhead but quicker recovery on failure. 100 is a reasonable default for our throughput; revisit if events-per-second exceeds a few hundred.

The 1.5-second sleep on empty results is the polling cadence. Latency between event publication and projection is therefore at most 1.5 seconds plus the projector's processing time — perfectly fine for CRM-shaped use cases. If we ever need lower latency (we won't, but if), the upgrade path is Postgres `LISTEN/NOTIFY` per the deferral in D8.

## Replaying a projector

The most common operational task is replaying a projector after fixing a bug or recovering from an integration outage. The procedure is one SQL statement and a worker restart.

```sql
-- to replay everything since a known-good cursor:
UPDATE projector_state
SET last_processed_event_id = 1234567
WHERE projector_name = 'zoho';

-- to replay everything from the beginning:
UPDATE projector_state
SET last_processed_event_id = 0
WHERE projector_name = 'zoho';
```

After the cursor is updated, restart the worker (or wait up to 1.5s for the next poll). The projector will process every event since the new cursor position. Idempotency in the projector is therefore important — calling Zoho's `Contact upsert` API twice for the same user must produce the same result. Most external APIs are idempotent on upsert by default; for the rare ones that aren't, the projector should check existence before creating.

Replaying does not affect other projectors. Resetting Zoho's cursor to 0 does not cause Xero to re-issue invoices. They have independent cursors.

## Adding a new projector

The flow when you want to add a new integration (MailChimp, Slack notifications, internal analytics):

Create a new class in `apps/worker/src/projectors/<name>.ts` implementing `IProjector`. Decide which event types it cares about based on the catalog above; ignore the rest. Implement `process(event)` to call the external system's API.

Insert a new row into `projector_state` with `projector_name='<name>'` and `last_processed_event_id` set to either 0 (process every event ever) or the current max event id (process only events from now on, no backfill). Most new projectors want the latter — backfilling years of events into a new system is rarely useful and risks rate-limit burns.

Wire the new projector into the worker's composition root in `apps/worker/src/container.ts`. Add it to the runner's projector list. Deploy.

Update the event catalog table in this document to list the new projector under "Consumers" for each event type it processes.

That's the complete checklist. No changes to `apps/api`, no changes to existing projectors, no changes to the schema beyond the one row in `projector_state`. This is the leverage that the outbox pattern buys you.

## Schema versioning

Event payloads evolve. When you change the shape of a payload, you bump `schema_version` for that event type and update every projector that consumes it.

The pattern is to handle both versions in the projector for at least one full deployment cycle (typically a week) so that in-flight events from before the deploy continue to work. After enough time has passed that no v1 events remain in the table, the v1 code path can be removed.

```typescript
async process(event: DomainEvent): Promise<void> {
  if (event.eventType !== "bid.lot_won") return;
  if (event.schemaVersion === 1) {
    return this.handleV1(event.payload);
  }
  if (event.schemaVersion === 2) {
    return this.handleV2(event.payload);
  }
  throw new Error(`Unknown schema version ${event.schemaVersion} for bid.lot_won`);
}
```

Throwing on unknown schema versions is correct — it means a deploy went out without the projector being updated, which is a bug we want to surface immediately, not silently ignore.

## Retention

Events are kept forever per Q50. The audit-log property is one of the main reasons we use this pattern; truncating the table defeats it. When the table size becomes operationally problematic (estimated at 100GB+), archive cold rows to DigitalOcean Spaces in monthly partitions and drop them from the live table — the projector cursors will continue to work because they only ever query for `id > $cursor`.

Archive format: gzipped NDJSON, one row per line, organized by year-month. A simple cron job in `apps/worker` does this monthly. Restoration (rare) is a manual SQL `COPY FROM` after pulling the archive back from Spaces.

## Email pipeline

The email pipeline is a **second outbox** that lives alongside the domain-events outbox but is structurally separate. Domain events project business state into Zoho/Xero; the email outbox sends physical mail. They share the same architectural pattern (durable handoff in Postgres + worker drain) but they have different tables, different idempotency models, and different consumers. Reusing the domain-events outbox for email would couple "we sent the user a receipt" to "we told the CRM about a payment", and that coupling is exactly what we wanted to avoid.

Schema-level details for the four tables (`email_outbox`, `email_event`, `email_suppression`, `newsletter_signup_log`) and the user/notification-preference extensions are in [03-data-model.md → "Email-pipeline tables"](./03-data-model.md#email-pipeline-tables--email_outbox-email_event-email_suppression-newsletter_signup_log). Operational and provider-onboarding details are in [../integrations/email.md](../integrations/email.md). Incident response is in [../runbooks/email-provider-incident.md](../runbooks/email-provider-incident.md).

> **Implementation status (last reviewed 2026-05-05).** The full transactional/notification path described below is **implemented**: `IEmailService` in `@auction/email`, the BullMQ `email` queue with `outbox-drain` repeatable job, the Postmark sender with List-Unsubscribe headers, the `/webhooks/postmark` ingest, and the HMAC-signed unsubscribe route. The marketing path (newsletter → Zoho Campaigns) is implemented as a one-way push via the `marketing-sync` queue. WhatsApp channel is a stub that throws `NotImplementedError`. The known runtime gap is the role grants for `auth_app` and `worker_app` — see the data-model status block.

### Why a second outbox

The domain-events outbox is "what business state changed". The email outbox is "what message did we promise to send". They have different lifecycles:

- A domain event row is **append-only and never updated** — projectors track their position via `projector_state.last_processed_event_id`. An email outbox row goes through a full state machine (`pending` → `sending` → `sent`/`failed`/`suppressed`) so the worker can express "I tried, here's the Postmark `MessageID` so you can correlate the bounce three hours from now".
- A domain event has **N consumers** (Zoho, Xero, MailChimp later). An email outbox row has **exactly one consumer** — the BullMQ `send-email` job for that specific row, identified by `jobId = outboxId`.
- A domain event's idempotency key is its DB-assigned `id`. An email outbox row is deduplicated on a content-derived `idempotency_key` so the same logical send (same template, same user, same vars) collapses to a single row even when callers retry.

If you find yourself wanting to reuse `domain_events` for an outbound mail, stop and write to `email_outbox` instead. If you want to add a second mail provider, add a second `IEmailSender` implementation in `apps/worker`; do not add an `email_projector_state` row to the domain-events runner.

### Transactional/notification flow

```mermaid
flowchart LR
  Caller["apps/auth or apps/api<br/>e.g. NotificationDispatcher,<br/>Better Auth send-verify hook"]
  Outbox[("email_outbox")]
  Suppression[("email_suppression")]
  Q[["BullMQ 'email' queue"]]
  Worker["apps/worker<br/>send-email job"]
  Postmark["Postmark<br/>(transactional + broadcast streams)"]
  User(((User mailbox)))
  Webhook["apps/api<br/>POST /webhooks/postmark"]
  Event[("email_event")]
  UserTbl[("user.email_status")]

  Caller -->|enqueue| Outbox
  Outbox -.->|lookup hash| Suppression
  Outbox -->|jobId=outboxId| Q
  Q --> Worker
  Worker --> Postmark
  Postmark --> User
  Postmark -.->|delivery, bounce,<br/>complaint, open, click| Webhook
  Webhook --> Event
  Webhook -->|hard_bounce or<br/>complaint| Suppression
  Webhook -->|hard_bounce -> bounced<br/>complaint -> complained| UserTbl

  style Outbox fill:#FAEEDA,stroke:#854F0B,color:#633806
  style Event fill:#FAEEDA,stroke:#854F0B,color:#633806
  style Suppression fill:#FAEEDA,stroke:#854F0B,color:#633806
  style UserTbl fill:#FAEEDA,stroke:#854F0B,color:#633806
  style Q fill:#E1F5EE,stroke:#0F6E56,color:#085041
  style Worker fill:#E1F5EE,stroke:#0F6E56,color:#085041
  style Postmark fill:#EAF3DE,stroke:#3B6D11,color:#27500A
  style Webhook fill:#EEEDFE,stroke:#534AB7,color:#3C3489
  style Caller fill:#EEEDFE,stroke:#534AB7,color:#3C3489
```

The flow:

1. A caller (the Better Auth `sendVerificationEmail` hook in `apps/auth`, the `NotificationDispatcher`'s email channel in `apps/api`, the invite service, etc.) calls `IEmailService.enqueue({ template, to, vars, category, userId? })`. The service hashes the address, looks it up in `email_suppression`, and inserts an `email_outbox` row. Auth-category sends bypass suppression but record `flagged_address=true`.
2. The same call enqueues a BullMQ job on the `email` queue with `jobId = outboxId`. BullMQ's per-jobId dedupe means a second enqueue for the same outbox row is a no-op.
3. The `send-email` worker job claims the row (`status pending → sending`), renders the React Email template via `@auction/email`'s `render`, calls Postmark with the right stream and List-Unsubscribe headers (omitted for the `auth` and payment categories), then writes back `status sent`, `message_id`, `sent_at`. Failures trigger the BullMQ retry policy (5 attempts, exponential backoff base 30s) and after exhaustion land the row in `failed`.
4. A repeatable `outbox-drain` job runs every 60s and re-enqueues any `pending` rows that BullMQ never claimed (defensive against process crash between insert and `queue.add`).
5. Postmark posts delivery callbacks to `POST /webhooks/postmark` (Basic Auth). The handler inserts an `email_event` row and, on hard bounces or complaints, upserts `email_suppression` and flips `user.email_status`.

### Caller-side vs worker-side seams

There are two interfaces, on purpose:

- `IEmailService` in `@auction/email` exposes only `enqueue()`. Every caller in `apps/api` and `apps/auth` depends on this. It does not know about Postmark.
- `IEmailSender` in `@auction/email` exposes only `send(outboxRow, renderedEmail)`. Only the `send-email` worker job depends on this. Today there is one implementation, `PostmarkEmailSender` in `apps/worker/src/infrastructure/postmark-email.sender.ts`.

If a caller is tempted to import `postmark` directly, that's the bug — it bypasses the outbox, the suppression check, the retry policy, and the `email_event` correlation. Code review rejects any import of a provider SDK from a caller-side path.

### Marketing flow (Zoho Campaigns one-way push)

```mermaid
flowchart LR
  Form["Web newsletter form"]
  ApiNl["apps/api<br/>POST /api/newsletter/subscribe"]
  Log[("newsletter_signup_log")]
  Q2[["BullMQ 'marketing-sync' queue"]]
  Worker2["apps/worker<br/>zoho-campaigns-sync job"]
  Zoho["Zoho Campaigns API<br/>(EU region)"]

  Form --> ApiNl
  ApiNl -->|insert status=queued| Log
  ApiNl --> Q2
  Q2 --> Worker2
  Worker2 --> Zoho
  Worker2 -->|update status,<br/>zoho_response_code| Log

  style Log fill:#FAEEDA,stroke:#854F0B,color:#633806
  style Q2 fill:#E1F5EE,stroke:#0F6E56,color:#085041
  style Worker2 fill:#E1F5EE,stroke:#0F6E56,color:#085041
  style Zoho fill:#EAF3DE,stroke:#3B6D11,color:#27500A
  style ApiNl fill:#EEEDFE,stroke:#534AB7,color:#3C3489
  style Form fill:#EEEDFE,stroke:#534AB7,color:#3C3489
```

The newsletter signup is **fire-and-forget into Zoho**. Subscriber state, double-opt-in confirmation mail, and unsubscribe links for marketing campaigns all live in Zoho — we deliberately do not maintain a parallel subscriber table. The `newsletter_signup_log` table only proves what we tried to push and what Zoho said back; it is read for GDPR access/erasure requests, not for sending.

There is no "Brevo" or other secondary marketing provider in this design. If Zoho Campaigns ever becomes unworkable, swapping it is a `IMarketingSender` change in `apps/worker` plus updating the runbook — but until then there is one provider for marketing and one provider for transactional, and they do not share infrastructure.

### Unsubscribe and preference center

There are two flavours of opt-out:

- **Per-notification opt-out.** Used by the `outbid`, `lot_won`, and `lot_ended_seller` templates. The List-Unsubscribe URL embeds an HMAC-signed token scoped to `(userId, notificationType)` (created in `apps/api/src/lib/email-unsubscribe-token.ts`). Hitting the URL flips the matching `notification_preference.*_email` column to `false`. `email_suppression` is **not** written, so other notification types and `auth`/payment mail continue to flow.
- **Global opt-out.** Used when the user clicks the "stop sending me anything" link in the preference center, or when Postmark posts a `SubscriptionChange` for the broadcast stream. Writes a row to `email_suppression(reason='unsubscribe')`. From that point all `transactional`-category sends short-circuit to `status='suppressed'`; `auth`-category sends still go through but the row is flagged.

`auth` and `payment` templates intentionally do not include List-Unsubscribe headers — they are operational mail under the Gmail/Yahoo bulk-sender rules and exempt from the one-click requirement. Suppression also does not block them; the user must close their account to stop those.

### Idempotency, PII, and retention

- **Idempotency.** `email_outbox.idempotency_key` defaults to `template:userId-or-emailHash:sha256(canonical(vars))`. Callers can override when there's a more meaningful key (e.g. `bid.outbid:lotId:userId`). The unique index makes duplicate enqueues collapse to the first row.
- **PII.** Recipient addresses live as `to_email_hash` (SHA-256, kept forever) and optionally `to_snapshot` (plaintext, purged at `to_snapshot_purge_at`, default 30 days). Templates that resolve at enqueue (`invite`) snapshot; templates that resolve at send-time from `user.id` do not. The hash-only retention means a GDPR Article 17 deletion request on the user wipes `to_snapshot` immediately and leaves only the hashed audit trail.
- **Retention.** `email_outbox` and `email_event` are kept for 12 months for delivery analytics. `email_suppression` is kept until the user explicitly resubscribes (Gmail/Yahoo expect long memory here). `newsletter_signup_log` is kept 24 months for GDPR audit. None of these have an automatic purge job today; cleanup is **(planned)**.

### Adding a new email template

1. Add the React Email TSX template to `packages/email/src/templates/` and export it from `packages/email/src/index.ts`.
2. Add the template name to `TemplateName` and the variables to `TemplateVarsByName` in `packages/email/src/types.ts`.
3. Add the template to `RECIPIENT_RESOLUTION` (`'snapshot'` if the recipient is not a registered user yet, `'user'` if it resolves from `user.id` at send time).
4. Pick a category (`auth` for verification/reset/invite/password-changed/change-email; `transactional` for everything else) and decide whether the template needs a List-Unsubscribe URL — if yes, the corresponding `notification_preference.*_email` toggle needs to exist.
5. Call `emailService.enqueue({ template: '<name>', to, vars, category, userId? })` from the relevant service.

No worker change is needed; the `send-email` job is template-agnostic and renders via the registry. Postmaster onboarding (warming a new `From`, adding a new sender domain, etc.) is in `docs/integrations/email.md`.
