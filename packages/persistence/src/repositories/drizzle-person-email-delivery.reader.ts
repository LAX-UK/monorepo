import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  emailEvent,
  emailOutbox,
  emailSuppression,
} from "@auction/db/schema";
import type { EmailEventType } from "@auction/db/schema";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type {
  IPersonEmailDeliveryReader,
  PersonEmailAddressStatus,
  PersonEmailBlockRecord,
  PersonEmailDeliveryRecord,
  PersonEmailSendRecord,
} from "../interfaces/person-email-delivery.reader.js";

/** Provider reports shown with a send. Opens and clicks are not tracked. */
const REPORTED_EVENTS: EmailEventType[] = [
  "delivered",
  "bounce",
  "soft_bounce",
  "complaint",
  "unsubscribe",
];

const ADDRESS_STATUSES: readonly PersonEmailAddressStatus[] = ["ok", "bounced", "complained"];

function asAddressStatus(value: string | null | undefined): PersonEmailAddressStatus {
  return ADDRESS_STATUSES.find((s) => s === value) ?? "ok";
}

export class DrizzlePersonEmailDeliveryReader implements IPersonEmailDeliveryReader {
  constructor(private readonly db: Database) {}

  async findAddress(userId: string): Promise<{ email: string } | null> {
    const [row] = await this.db
      .select({ email: bidIdentityDirectory.email })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row ?? null;
  }

  async read(input: {
    userId: string;
    emailHash: string;
    sendLimit: number;
  }): Promise<PersonEmailDeliveryRecord> {
    const [profile] = await this.db
      .select({ emailStatus: bidUserProfile.emailStatus })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, input.userId))
      .limit(1);

    const outbox = await this.db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.userId, input.userId))
      .orderBy(desc(emailOutbox.createdAt))
      .limit(input.sendLimit);

    const events = await this.eventsForMessages(
      outbox.map((row) => row.messageId).filter((id): id is string => id !== null),
    );
    const sends: PersonEmailSendRecord[] = outbox.map((row) => ({
      id: row.id,
      template: row.template,
      vars: row.vars,
      outboxStatus: row.status,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      events: row.messageId ? (events.get(row.messageId) ?? []) : [],
    }));

    return {
      addressStatus: asAddressStatus(profile?.emailStatus),
      lastDeliveredAt: await this.lastDeliveredAt(input.userId),
      block: await this.activeBlock(input),
      sends,
    };
  }

  private async eventsForMessages(
    messageIds: string[],
  ): Promise<Map<string, PersonEmailSendRecord["events"]>> {
    const byMessage = new Map<string, PersonEmailSendRecord["events"]>();
    if (messageIds.length === 0) return byMessage;
    const rows = await this.db
      .select({
        messageId: emailEvent.messageId,
        type: emailEvent.type,
        receivedAt: emailEvent.receivedAt,
      })
      .from(emailEvent)
      .where(
        and(inArray(emailEvent.messageId, messageIds), inArray(emailEvent.type, REPORTED_EVENTS)),
      )
      .orderBy(emailEvent.receivedAt);
    for (const row of rows) {
      if (!row.messageId) continue;
      const list = byMessage.get(row.messageId) ?? [];
      list.push({ type: row.type, receivedAt: row.receivedAt });
      byMessage.set(row.messageId, list);
    }
    return byMessage;
  }

  private async lastDeliveredAt(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: sql<Date | null>`max(${emailEvent.receivedAt})` })
      .from(emailEvent)
      .innerJoin(emailOutbox, eq(emailOutbox.messageId, emailEvent.messageId))
      .where(and(eq(emailOutbox.userId, userId), eq(emailEvent.type, "delivered")));
    return row?.at ? new Date(row.at) : null;
  }

  private async activeBlock(input: {
    userId: string;
    emailHash: string;
  }): Promise<PersonEmailBlockRecord | null> {
    const [block] = await this.db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, input.emailHash))
      .limit(1);
    if (!block) return null;
    const [report] = await this.db
      .select({ payload: emailEvent.payload })
      .from(emailEvent)
      .innerJoin(emailOutbox, eq(emailOutbox.messageId, emailEvent.messageId))
      .where(
        and(
          eq(emailOutbox.userId, input.userId),
          isNotNull(emailEvent.messageId),
          inArray(emailEvent.type, ["bounce", "complaint"]),
        ),
      )
      .orderBy(desc(emailEvent.receivedAt))
      .limit(1);
    return {
      emailHash: block.emailHash,
      reason: block.reason,
      since: block.createdAt,
      providerDetail: providerDetailOf(report?.payload),
    };
  }
}

function providerDetailOf(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  for (const key of ["Details", "Description"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim().slice(0, 500);
  }
  return null;
}
