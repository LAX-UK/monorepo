import type { Database } from "@auction/db";
import { account, domainEvent } from "@auction/db/schema";
import { eq } from "drizzle-orm";

export type UserRegisteredSource = "credential" | "google" | "apple";

export type PublishUserRegisteredInput = {
  userId: string;
  email: string;
  name: string;
};

async function resolveRegistrationSource(
  db: Database,
  userId: string,
): Promise<UserRegisteredSource> {
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

/** Emits `user.registered` for the worker legal-entity provisioning projector. */
export async function publishUserRegistered(
  db: Database,
  input: PublishUserRegisteredInput,
): Promise<void> {
  const source = await resolveRegistrationSource(db, input.userId);
  await db.insert(domainEvent).values({
    aggregateType: "user",
    aggregateId: input.userId,
    eventType: "user.registered",
    producer: "apps/auth",
    payload: {
      userId: input.userId,
      email: input.email,
      name: input.name,
      source,
    },
    actorUserId: null,
    schemaVersion: 1,
  });
}
