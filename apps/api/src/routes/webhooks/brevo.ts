import type { EmailSuppressionReason } from "@auction/db/schema";
import { emailSuppression, user } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../../container.js";

type BrevoPayload = Record<string, unknown> & {
  event?: string;
  email?: string;
};

let warnedMissingSecret = false;

/**
 * Brevo marketing-contacts webhook: maps unsubscribe / blocklist / bounce / spam
 * events into `email_suppression` (and `user.email_status` for bounce/complaint), so
 * opt-outs are honored by the contact-sync job and survive a later switch to Zoho.
 */
export function createBrevoWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/", async (c) => {
    const expected = container.env.BREVO_WEBHOOK_SECRET;
    if (!expected && container.env.NODE_ENV === "production") {
      return c.json({ error: "brevo_webhook_not_configured" }, 503);
    }
    if (!isAuthorized(c, expected)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = (await c.req.json().catch(() => ({}))) as BrevoPayload;
    const event = String(payload.event ?? "").toLowerCase();
    const reason = mapEventToSuppressionReason(event);
    const email = normalizeEmail(payload.email);

    if (!reason || !email) {
      // Delivery/open/click and unknown events are acknowledged but not acted on.
      return c.json({ ok: true });
    }

    await upsertSuppression(container, emailHash(email), reason);

    if (reason === "hard_bounce" || reason === "complaint") {
      await container.db
        .update(user)
        .set({
          emailStatus: reason === "complaint" ? "complained" : "bounced",
          emailStatusChangedAt: new Date(),
        })
        .where(sql`lower(${user.email}) = ${email}`);
    }

    return c.json({ ok: true });
  });

  return r;
}

function isAuthorized(
  c: {
    req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  },
  expected: string | undefined,
): boolean {
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("BREVO_WEBHOOK_SECRET is unset; accepting Brevo webhook in non-production");
    }
    return true;
  }
  const provided = c.req.query("secret") ?? c.req.header("x-brevo-secret");
  return provided === expected;
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

async function upsertSuppression(
  container: Container,
  emailHashValue: string,
  reason: EmailSuppressionReason,
): Promise<void> {
  await container.db
    .insert(emailSuppression)
    .values({ emailHash: emailHashValue, reason })
    .onConflictDoUpdate({
      target: emailSuppression.emailHash,
      set: { reason, createdAt: new Date() },
    });
}
