import { and, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { account, domainEvent } from "../schema/index.js";

export type UserRegisteredSource = "credential" | "google" | "apple" | "backfill";

export type PublishUserRegisteredInput = {
  userId: string;
  email: string;
  name: string;
};

export type PublishUserRegisteredOptions = {
  /** Event producer label (e.g. `apps/auth`, `apps/api`, `ops/backfill-brevo`). */
  producer: string;
  /** Auth-owned DB handle for `account` lookups when event + account tables are split. */
  accountDb?: Database;
  /** When set, skips the account lookup (ops backfills). */
  source?: UserRegisteredSource;
};

export type PublishUserRegisteredResult = {
  inserted: boolean;
};

async function resolveRegistrationSource(
  db: Database,
  userId: string,
): Promise<Exclude<UserRegisteredSource, "backfill">> {
  const [row] = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
    .limit(1);
  if (!row) return "credential";
  const provider = row.providerId.toLowerCase();
  if (provider === "google") return "google";
  if (provider === "apple") return "apple";
  return "credential";
}

/** Idempotently appends `user.registered` for marketing-contacts + legal-entity projectors.
 *
 * Uses a cheap SELECT pre-check plus the `domain_events_user_registered_uid` partial unique
 * index (see migration 0112) so concurrent callers collapse to a single event per user.
 */
export async function publishUserRegistered(
  db: Database,
  input: PublishUserRegisteredInput,
  options: PublishUserRegisteredOptions,
): Promise<PublishUserRegisteredResult> {
  const [existing] = await db
    .select({ id: domainEvent.id })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateType, "user"),
        eq(domainEvent.aggregateId, input.userId),
        eq(domainEvent.eventType, "user.registered"),
      ),
    )
    .limit(1);
  if (existing) return { inserted: false };

  const source =
    options.source ?? (await resolveRegistrationSource(options.accountDb ?? db, input.userId));

  const inserted = await db
    .insert(domainEvent)
    .values({
      aggregateType: "user",
      aggregateId: input.userId,
      eventType: "user.registered",
      producer: options.producer,
      payload: {
        userId: input.userId,
        email: input.email,
        name: input.name,
        source,
      },
      actorUserId: null,
      schemaVersion: 1,
    })
    .onConflictDoNothing()
    .returning({ id: domainEvent.id });

  return { inserted: inserted.length > 0 };
}
