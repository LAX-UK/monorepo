import { emailEvent, emailOutbox, emailSuppression, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../../container.js";
import { applyUnsubscribeToken } from "../email.js";

type PostmarkPayload = Record<string, unknown> & {
  RecordType?: string;
  MessageID?: string;
  MessageId?: string;
  Type?: string;
};

let warnedMissingAuth = false;

export function createPostmarkWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/", async (c) => {
    if (!container.env.POSTMARK_WEBHOOK_BASIC_AUTH && container.env.NODE_ENV === "production") {
      return c.json({ error: "postmark_webhook_not_configured" }, 503);
    }
    if (!isAuthorized(c.req.header("authorization"), container.env.POSTMARK_WEBHOOK_BASIC_AUTH)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = (await c.req.json().catch(() => ({}))) as PostmarkPayload;
    const recordType = String(payload.RecordType ?? "");
    const messageId = String(payload.MessageID ?? payload.MessageId ?? "");
    const eventType = mapRecordType(recordType, payload);

    await container.db.insert(emailEvent).values({
      messageId: messageId || null,
      type: eventType,
      provider: "postmark",
      payload,
    });

    if (messageId && (eventType === "bounce" || eventType === "complaint")) {
      await applySuppression(container, messageId, eventType);
    }
    if (eventType === "unsubscribe") {
      const token = extractUnsubscribeToken(payload);
      if (token) await applyUnsubscribeToken(container, token);
    }

    return c.json({ ok: true });
  });

  return r;
}

function extractUnsubscribeToken(payload: PostmarkPayload): string | null {
  const metadata = payload.Metadata;
  if (metadata && typeof metadata === "object") {
    const token = (metadata as Record<string, unknown>).unsubscribe_token;
    if (typeof token === "string") return token;
  }
  const token = payload.unsubscribe_token ?? payload.UnsubscribeToken;
  return typeof token === "string" ? token : null;
}

function isAuthorized(header: string | undefined, expected: string | undefined): boolean {
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    if (!warnedMissingAuth) {
      warnedMissingAuth = true;
      console.warn(
        "POSTMARK_WEBHOOK_BASIC_AUTH is unset; accepting Postmark webhook in non-production",
      );
    }
    return true;
  }
  if (!header?.startsWith("Basic ")) return false;
  const value = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  return value === expected;
}

function mapRecordType(recordType: string, payload: PostmarkPayload) {
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

async function applySuppression(
  container: Container,
  messageId: string,
  eventType: "bounce" | "complaint",
) {
  const [row] = await container.db
    .select({
      id: emailOutbox.id,
      userId: emailOutbox.userId,
      toEmailHash: emailOutbox.toEmailHash,
    })
    .from(emailOutbox)
    .where(eq(emailOutbox.messageId, messageId))
    .limit(1);
  if (!row) return;

  await container.db
    .insert(emailSuppression)
    .values({
      emailHash: row.toEmailHash,
      reason: eventType === "complaint" ? "complaint" : "hard_bounce",
    })
    .onConflictDoUpdate({
      target: emailSuppression.emailHash,
      set: {
        reason: eventType === "complaint" ? "complaint" : "hard_bounce",
        createdAt: new Date(),
      },
    });

  if (row.userId) {
    await container.db
      .update(user)
      .set({
        emailStatus: eventType === "complaint" ? "complained" : "bounced",
        emailStatusChangedAt: new Date(),
      })
      .where(eq(user.id, row.userId));
  }
}
