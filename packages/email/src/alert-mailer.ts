import type { AlertMailer, ConfirmationMessage, DigestMessage } from "@auction/alerts";
import { confirmationEmail, digestDateLabel, digestEmail } from "./alert-emails.js";
import type { IEmailService } from "./service.js";

export { digestDateLabel };

export type AlertMailerOptions = { email: IEmailService };

/**
 * Hands the engine's emails to the outbox. Confirmations go at once on the transactional stream;
 * digests go on the broadcast stream, which keeps bulk mail apart from receipts and sign-in codes.
 * The outbox keys make a retried send collapse into one row.
 */
export class OutboxAlertMailer implements AlertMailer {
  constructor(private readonly options: AlertMailerOptions) {}

  async sendConfirmation(message: ConfirmationMessage): Promise<void> {
    const { template, vars, idempotencyKey } = confirmationEmail(message);
    await this.options.email.enqueue({
      template,
      to: message.to,
      category: "transactional",
      idempotencyKey,
      vars,
    });
  }

  async sendDigest(message: DigestMessage): Promise<void> {
    const { template, vars, idempotencyKey, stream } = digestEmail(message);
    await this.options.email.enqueue({
      template,
      to: message.to,
      category: "transactional",
      ...(stream ? { stream } : {}),
      idempotencyKey,
      vars,
    });
  }
}
