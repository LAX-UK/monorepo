import type { EmailSuppressionReason } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import type { IEmailSuppressionRepository, IEmailWebhookIngestRepository } from "@auction/persistence/interfaces";

export type BrevoWebhookPayload = Record<string, unknown> & {
  event?: string;
  email?: string;
};

export class BrevoWebhookIngestService {
  constructor(
    private readonly emailSuppressions: IEmailSuppressionRepository,
    private readonly emailWebhookIngest: IEmailWebhookIngestRepository,
  ) {}

  async handle(payload: BrevoWebhookPayload): Promise<void> {
    const event = String(payload.event ?? "").toLowerCase();
    const reason = mapEventToSuppressionReason(event);
    const email = normalizeEmail(payload.email);

    if (!reason || !email) {
      return;
    }

    await this.emailSuppressions.upsert(emailHash(email), reason);

    if (reason === "hard_bounce" || reason === "complaint") {
      await this.emailWebhookIngest.updateUserEmailStatusByEmail(
        email,
        reason === "complaint" ? "complained" : "bounced",
      );
    }
  }
}

function mapEventToSuppressionReason(event: string): EmailSuppressionReason | null {
  switch (event) {
    case "unsubscribe":
    case "unsubscribed":
    case "list_unsubscribe":
    case "blocked":
    case "blocklist":
    case "blacklist":
      return "unsubscribe";
    case "spam":
    case "complaint":
      return "complaint";
    case "hard_bounce":
    case "hardbounce":
      return "hard_bounce";
    default:
      return null;
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes("@") && trimmed.length > 3 ? trimmed : null;
}
