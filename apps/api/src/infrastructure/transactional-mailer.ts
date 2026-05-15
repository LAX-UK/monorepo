import type { Env } from "../env.js";
import type {
  ITransactionalMailer,
  TransactionalMailPayload,
} from "../services/interfaces/transactional-mail.js";

class ConsoleTransactionalMailer implements ITransactionalMailer {
  async send(input: TransactionalMailPayload): Promise<void> {
    console.info("[mail]", {
      to: input.to,
      subject: input.subject,
      meta: input.meta ?? null,
    });
  }
}

class WebhookTransactionalMailer implements ITransactionalMailer {
  constructor(
    private readonly webhookUrl: string,
    private readonly from: string | undefined,
  ) {}

  async send(input: TransactionalMailPayload): Promise<void> {
    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        from: this.from ?? null,
        subject: input.subject,
        text: input.text,
        meta: input.meta ?? {},
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Transactional mail webhook failed (${res.status}): ${body}`);
    }
  }
}

export function createTransactionalMailer(env: Env): ITransactionalMailer {
  if (env.INVITE_EMAIL_WEBHOOK_URL) {
    return new WebhookTransactionalMailer(env.INVITE_EMAIL_WEBHOOK_URL, env.INVITE_EMAIL_FROM);
  }
  return new ConsoleTransactionalMailer();
}
