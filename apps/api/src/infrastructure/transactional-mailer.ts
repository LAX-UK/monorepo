import postmark from "postmark";
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
        html: input.html ?? null,
        meta: input.meta ?? {},
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Transactional mail webhook failed (${res.status}): ${body}`);
    }
  }
}

class PostmarkTransactionalMailer implements ITransactionalMailer {
  private readonly client: postmark.ServerClient;

  constructor(
    private readonly opts: {
      serverToken: string;
      from: string;
      replyTo?: string | undefined;
      transactionalStream: string;
    },
  ) {
    this.client = new postmark.ServerClient(opts.serverToken);
  }

  async send(input: TransactionalMailPayload): Promise<void> {
    const message: postmark.Message = {
      From: this.opts.from,
      To: input.to,
      Subject: input.subject,
      TextBody: input.text,
      MessageStream: this.opts.transactionalStream,
    };
    if (input.html) message.HtmlBody = input.html;
    if (this.opts.replyTo) message.ReplyTo = this.opts.replyTo;

    const tag = input.meta?.kind;
    if (typeof tag === "string" && tag.length > 0) {
      message.Tag = tag;
    }

    if (input.meta) {
      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.meta)) {
        if (value == null) continue;
        metadata[key] = String(value);
      }
      if (Object.keys(metadata).length > 0) {
        message.Metadata = metadata;
      }
    }

    await this.client.sendEmail(message);
  }
}

function resolveFrom(env: Env): string {
  return env.INVITE_EMAIL_FROM ?? env.EMAIL_FROM;
}

export function createTransactionalMailer(env: Env): ITransactionalMailer {
  if (env.EMAIL_PROVIDER === "postmark" && env.POSTMARK_SERVER_TOKEN) {
    return new PostmarkTransactionalMailer({
      serverToken: env.POSTMARK_SERVER_TOKEN,
      from: resolveFrom(env),
      replyTo: env.EMAIL_REPLY_TO,
      transactionalStream: env.POSTMARK_TRANSACTIONAL_STREAM,
    });
  }
  if (env.INVITE_EMAIL_WEBHOOK_URL) {
    return new WebhookTransactionalMailer(env.INVITE_EMAIL_WEBHOOK_URL, env.INVITE_EMAIL_FROM);
  }
  return new ConsoleTransactionalMailer();
}
