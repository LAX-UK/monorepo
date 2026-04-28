import type { Env } from "../env.js";
import type { InviteEmailInput, ITransactionalMailer } from "../services/interfaces/transactional-mail.js";

class ConsoleTransactionalMailer implements ITransactionalMailer {
  async sendInviteEmail(input: InviteEmailInput): Promise<void> {
    // Local/dev behavior: visible, provider-agnostic, and safe by default.
    console.info("[mail:invite]", {
      to: input.to,
      targetRole: input.targetRole,
      inviteLink: input.inviteLink,
    });
  }
}

class WebhookTransactionalMailer implements ITransactionalMailer {
  constructor(
    private readonly webhookUrl: string,
    private readonly from: string | undefined,
  ) {}

  async sendInviteEmail(input: InviteEmailInput): Promise<void> {
    const subject = `You're invited to LAX (${input.targetRole})`;
    const text = `You've been invited to create an account on LAX.\n\nSign up here:\n${input.inviteLink}\n`;
    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        from: this.from ?? null,
        subject,
        text,
        meta: { kind: "invite", targetRole: input.targetRole },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Invite email webhook failed (${res.status}): ${body}`);
    }
  }
}

export function createTransactionalMailer(env: Env): ITransactionalMailer {
  if (env.INVITE_EMAIL_WEBHOOK_URL) {
    return new WebhookTransactionalMailer(env.INVITE_EMAIL_WEBHOOK_URL, env.INVITE_EMAIL_FROM);
  }
  return new ConsoleTransactionalMailer();
}
