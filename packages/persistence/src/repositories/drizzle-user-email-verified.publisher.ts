import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IUserEmailVerifiedPublisher,
  PublishUserEmailVerifiedInput,
} from "../interfaces/user-email-verified.publisher.js";

export class DrizzleUserEmailVerifiedPublisher implements IUserEmailVerifiedPublisher {
  constructor(private readonly db: Database) {}

  async publishIfAbsent(input: PublishUserEmailVerifiedInput): Promise<void> {
    const [existing] = await this.db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "user"),
          eq(domainEvent.aggregateId, input.userId),
          eq(domainEvent.eventType, "user.email_verified"),
        ),
      )
      .limit(1);
    if (existing) return;

    const now = new Date();
    await this.db
      .insert(domainEvent)
      .values({
        aggregateType: "user",
        aggregateId: input.userId,
        eventType: "user.email_verified",
        producer: "apps/api",
        payload: {
          userId: input.userId,
          email: input.email,
          verifiedAt: now.toISOString(),
        },
        actorUserId: input.userId,
        schemaVersion: 1,
      })
      .onConflictDoNothing();
  }
}
