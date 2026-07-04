import { emailHash } from "@auction/email";
import type { IEmailSuppressionRepository, IEmailWebhookIngestRepository } from "@auction/persistence/interfaces";

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
    private readonly emailWebhookIngest: IEmailWebhookIngestRepository,
    private readonly emailSuppressions: IEmailSuppressionRepository,
    private readonly onUnsubscribe: (token: string) => Promise<void>,
  ) {}

  async handle(payload: PostmarkWebhookPayload): Promise<void> {
    const recordType = String(payload.RecordType ?? "");
    const messageId = String(payload.MessageID ?? payload.MessageId ?? "");
    const eventType = mapRecordType(recordType, payload);

    await this.emailWebhookIngest.insertEmailEvent({
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
    const emailStatus = eventType === "complaint" ? "complained" : "bounced";

    if (messageId) {
      const row = await this.emailWebhookIngest.findOutboxByMessageId(messageId);
      if (row) {
        await this.emailSuppressions.upsert(row.toEmailHash, reason);
        if (row.userId) {
          await this.emailWebhookIngest.updateUserEmailStatusByUserId(row.userId, emailStatus);
        }
        return;
      }
    }

    const addr = recipientEmailFromPostmarkPayload(payload);
    if (!addr) return;
    await this.emailSuppressions.upsert(emailHash(addr), reason);
    await this.emailWebhookIngest.updateUserEmailStatusByEmail(addr, emailStatus);
  }

  private async maybeSuppressAfterSoftBounceThreshold(
    payload: PostmarkWebhookPayload,
  ): Promise<void> {
    const addr = recipientEmailFromPostmarkPayload(payload);
    if (!addr) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.emailWebhookIngest.countSoftBouncesForEmailSince(
      addr.toLowerCase(),
      since,
    );
    if (count < 3) return;
    await this.emailSuppressions.upsert(emailHash(addr), "soft_bounce_threshold");
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
