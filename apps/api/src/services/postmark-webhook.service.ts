import type { Database } from "@auction/db";
import { emailEvent, emailOutbox, emailSuppression, user } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { and, eq, gt, sql } from "drizzle-orm";

export type PostmarkWebhookPayload = Record<string, unknown> & {
  RecordType?: string;
  MessageID?: string;
  MessageId?: string;
  Type?: string;
  Email?: string;
  OriginalRecipient?: string;
  To?: string;
};

export class PostmarkWebhookService {
  constructor(
    private readonly db: Database,
    private readonly onUnsubscribe: (token: string) => Promise<void>,
  ) {}

  async handle(payload: PostmarkWebhookPayload): Promise<void> {
    const recordType = String(payload.RecordType ?? "");
    const messageId = String(payload.MessageID ?? payload.MessageId ?? "");
    const eventType = mapRecordType(recordType, payload);

    await this.db.insert(emailEvent).values({
      messageId: messageId || null,
      type: eventType,
      provider: "postmark",
      payload,
    });

    if (eventType === "bounce" || eventType === "complaint") {
      await this.applySuppressionFromWebhook(messageId, eventType, payload);
    }
    if (eventType === "soft_bounce") {
      await this.maybeSuppressAfterSoftBounceThreshold(payload);
    }
    if (eventType === "unsubscribe") {
      const token = extractUnsubscribeToken(payload);
      if (token) await this.onUnsubscribe(token);
    }
  }

  private async applySuppressionFromWebhook(
    messageId: string,
    eventType: "bounce" | "complaint",
    payload: PostmarkWebhookPayload,
  ): Promise<void> {
    const reason = eventType === "complaint" ? "complaint" : ("hard_bounce" as const);

    if (messageId) {
      const [row] = await this.db
        .select({
          id: emailOutbox.id,
          userId: emailOutbox.userId,
          toEmailHash: emailOutbox.toEmailHash,
        })
        .from(emailOutbox)
        .where(eq(emailOutbox.messageId, messageId))
        .limit(1);
      if (row) {
        await upsertSuppressionAndMaybeUser(this.db, row.toEmailHash, reason, row.userId);
        return;
      }
    }

    const addr = recipientEmailFromPostmarkPayload(payload);
    if (!addr) return;
    const hash = emailHash(addr);
    await upsertSuppressionAndMaybeUser(this.db, hash, reason, null);

    await this.db
      .update(user)
      .set({
        emailStatus: eventType === "complaint" ? "complained" : "bounced",
        emailStatusChangedAt: new Date(),
      })
      .where(sql`lower(${user.email}) = ${addr}`);
  }

  private async maybeSuppressAfterSoftBounceThreshold(
    payload: PostmarkWebhookPayload,
  ): Promise<void> {
    const addr = recipientEmailFromPostmarkPayload(payload);
    if (!addr) return;
    const addrLower = addr.toLowerCase();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [row] = await this.db
      .select({
        n: sql<number>`count(*)::int`,
      })
      .from(emailEvent)
      .where(
        and(
          eq(emailEvent.type, "soft_bounce"),
          gt(emailEvent.receivedAt, since),
          sql`(lower(coalesce(${emailEvent.payload}->>'Email','')) = ${addrLower} OR lower(coalesce(${emailEvent.payload}->>'OriginalRecipient','')) = ${addrLower})`,
        ),
      );
    const count = row?.n ?? 0;
    if (count < 3) return;
    const hash = emailHash(addr);
    await this.db
      .insert(emailSuppression)
      .values({
        emailHash: hash,
        reason: "soft_bounce_threshold",
      })
      .onConflictDoUpdate({
        target: emailSuppression.emailHash,
        set: {
          reason: "soft_bounce_threshold",
          createdAt: new Date(),
        },
      });
  }
}

function extractUnsubscribeToken(payload: PostmarkWebhookPayload): string | null {
  const metadata = payload.Metadata;
  if (metadata && typeof metadata === "object") {
    const token = (metadata as Record<string, unknown>).unsubscribe_token;
    if (typeof token === "string") return token;
  }
  const token = payload.unsubscribe_token ?? payload.UnsubscribeToken;
  return typeof token === "string" ? token : null;
}

function mapRecordType(recordType: string, payload: PostmarkWebhookPayload) {
  switch (recordType) {
    case "Delivery":
      return "delivered" as const;
    case "Bounce":
      return String(payload.Type ?? "")
        .toLowerCase()
        .includes("transient")
        ? ("soft_bounce" as const)
        : ("bounce" as const);
    case "SpamComplaint":
      return "complaint" as const;
    case "SubscriptionChange":
      return "unsubscribe" as const;
    case "Open":
      return "open" as const;
    case "Click":
      return "click" as const;
    default:
      return "delivered" as const;
  }
}

function recipientEmailFromPostmarkPayload(payload: PostmarkWebhookPayload): string | null {
  const candidates = [
    payload.Email,
    payload.OriginalRecipient,
    payload.To,
    (payload as { Recipient?: string }).Recipient,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) {
      const trimmed = c.trim().toLowerCase();
      if (trimmed.length > 3) return trimmed;
    }
  }
  return null;
}

async function upsertSuppressionAndMaybeUser(
  db: Database,
  emailHashValue: string,
  reason: "complaint" | "hard_bounce",
  userId: string | null,
) {
  await db
    .insert(emailSuppression)
    .values({
      emailHash: emailHashValue,
      reason,
    })
    .onConflictDoUpdate({
      target: emailSuppression.emailHash,
      set: {
        reason,
        createdAt: new Date(),
      },
    });

  if (userId) {
    await db
      .update(user)
      .set({
        emailStatus: reason === "complaint" ? "complained" : "bounced",
        emailStatusChangedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}
