import type { CredentialEmailInput, CredentialEmailSender, EmailSender } from "@auction/auth";
import {
  DURABLE_RETRY_DELAYS_MS,
  type SecurityEffectOutboxRepository,
} from "./durable-security-effects.js";
import { redactedEmailFailure } from "./redacted-email-failure.js";
import type { SecurityEffectLogger } from "./settle-security-effect.js";

/**
 * Sends the emails that carry a one-time link. The message goes straight to the email queue, so
 * the usual case adds no delay. When that fails, the message is written to the durable
 * security-effects outbox and retried from there with the same idempotency key. Only when the
 * outbox cannot take it either does `send` reject, so the request can fail instead of claiming
 * an email was sent.
 */
export class DurableCredentialEmail implements CredentialEmailSender {
  constructor(
    private readonly email: Pick<EmailSender, "enqueue">,
    private readonly outbox: Pick<SecurityEffectOutboxRepository, "enqueue">,
    private readonly log: SecurityEffectLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async send(input: CredentialEmailInput): Promise<void> {
    try {
      await this.email.enqueue(input);
      return;
    } catch (error) {
      const failure = redactedEmailFailure(error);
      this.log.warn({ template: input.template, failure }, "auth_credential_email_deferred");
      try {
        await this.outbox.enqueue({
          job: {
            kind: "send_identity_email",
            userId: input.userId ?? "",
            input,
          },
          error: failure,
          nextAttemptAt: new Date(this.now().getTime() + DURABLE_RETRY_DELAYS_MS[0]),
        });
      } catch (outboxError) {
        this.log.error(
          {
            template: input.template,
            failure,
            outboxFailure: redactedEmailFailure(outboxError),
          },
          "auth_credential_email_lost",
        );
        throw new Error("auth_credential_email_lost");
      }
    }
  }
}
