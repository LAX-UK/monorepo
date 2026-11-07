import { emailHash } from "@auction/email";

/** The two lists the sync reads from Zoho Campaigns. */
export type CampaignsContactKind = "unsubscribed" | "bounced";

/** One row of a Campaigns contact list, as Zoho sends it. Field names are read defensively. */
export type CampaignsContactRow = Record<string, unknown>;

export type CampaignsSuppressionEvent = {
  emailHash: string;
  reason: "unsubscribed_marketing" | "hard_bounce";
  /** When Zoho says it happened; null when the row carries no time that can be read. */
  occurredAt: Date | null;
};

export type CampaignsSkipReason = "no_email" | "soft_bounce" | "unknown_bounce_type";

export type CampaignsMapResult =
  | { ok: true; event: CampaignsSuppressionEvent }
  | { ok: false; skip: CampaignsSkipReason };

const EMAIL_FIELDS = ["contact_email", "Contact Email", "email", "Email"] as const;
const TIME_FIELDS: Record<CampaignsContactKind, readonly string[]> = {
  unsubscribed: ["unsubscribed_time", "unsubscribe_time", "Unsubscribed Time", "modified_time"],
  bounced: ["bounced_time", "bounce_time", "Bounced Time", "modified_time"],
};
const BOUNCE_TYPE_FIELDS = ["bounce_type", "Bounce Type", "bouncetype"] as const;

function firstString(row: CampaignsContactRow, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** ISO text or epoch milliseconds; anything else is treated as no time at all. */
function parseTime(row: CampaignsContactRow, fields: readonly string[]): Date | null {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
    if (typeof value === "string" && value.trim() !== "") {
      const text = value.trim();
      const parsed = /^\d{12,}$/.test(text) ? new Date(Number(text)) : new Date(text);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

/**
 * Turns one Campaigns row into a suppression event. An unsubscribe becomes the narrow marketing
 * opt-out; only a bounce Zoho calls hard becomes a hard bounce. A soft or unlabelled bounce is
 * skipped: LAX has its own soft-bounce threshold and an unlabelled one must not silence an address.
 */
export function mapCampaignsContact(
  kind: CampaignsContactKind,
  row: CampaignsContactRow,
): CampaignsMapResult {
  const email = firstString(row, EMAIL_FIELDS)?.toLowerCase();
  if (!email?.includes("@")) return { ok: false, skip: "no_email" };
  const occurredAt = parseTime(row, TIME_FIELDS[kind]);

  if (kind === "unsubscribed") {
    return {
      ok: true,
      event: { emailHash: emailHash(email), reason: "unsubscribed_marketing", occurredAt },
    };
  }

  const bounceType = firstString(row, BOUNCE_TYPE_FIELDS)?.toLowerCase();
  if (!bounceType) return { ok: false, skip: "unknown_bounce_type" };
  if (bounceType.startsWith("soft")) return { ok: false, skip: "soft_bounce" };
  if (!bounceType.startsWith("hard")) return { ok: false, skip: "unknown_bounce_type" };
  return { ok: true, event: { emailHash: emailHash(email), reason: "hard_bounce", occurredAt } };
}
