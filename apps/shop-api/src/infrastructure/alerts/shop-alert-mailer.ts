import type { AlertMailer, ConfirmationMessage, DigestMessage } from "@auction/alerts";
import type { Database } from "@auction/db";
import { confirmationEmail, digestEmail } from "@auction/email/alert-emails";
import { insertShopEmailOutbox } from "../drizzle-shop-notification.publisher.js";

/**
 * Puts the engine's emails on the shop's email outbox. The wording and variables come from the
 * same builders LAX Bid uses, so a Shop or lax.art email differs only in product: its name, its
 * company in the footer and its sender. Confirmations go on the transactional stream and digests
 * on the broadcast stream; the outbox key makes a retried send one row.
 */
export class ShopAlertMailer implements AlertMailer {
  constructor(private readonly db: Database) {}

  async sendConfirmation(message: ConfirmationMessage): Promise<void> {
    const { template, vars, idempotencyKey } = confirmationEmail(message);
    await insertShopEmailOutbox(this.db, { idempotencyKey, to: message.to, template, vars });
  }

  async sendDigest(message: DigestMessage): Promise<void> {
    const { template, vars, idempotencyKey, stream } = digestEmail(message);
    await insertShopEmailOutbox(this.db, {
      idempotencyKey,
      to: message.to,
      template,
      vars,
      ...(stream ? { stream } : {}),
    });
  }
}
