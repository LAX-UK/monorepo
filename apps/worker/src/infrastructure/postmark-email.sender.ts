import { renderEmail, type IEmailSender, type TemplateName, type TemplateVarsByName } from "@auction/email";
import postmark from "postmark";

type PostmarkEmailSenderOptions = {
  serverToken: string;
  from: string;
  replyTo?: string | undefined;
  transactionalStream: string;
  broadcastStream: string;
};

export class PostmarkEmailSender implements IEmailSender {
  private readonly client: postmark.ServerClient;

  constructor(private readonly opts: PostmarkEmailSenderOptions) {
    this.client = new postmark.ServerClient(opts.serverToken);
  }

  async send<T extends TemplateName>(payload: {
    outboxId: string;
    template: T;
    to: string;
    vars: TemplateVarsByName[T];
    stream: "transactional" | "broadcast";
    flaggedAddress: boolean;
    userId?: string | null;
  }): Promise<{ messageId: string }> {
    const rendered = await renderEmail(payload.template, payload.vars);
    const unsubscribeUrl = unsubscribeUrlFromVars(payload.vars);
    const message: postmark.Message = {
      From: this.opts.from,
      To: payload.to,
      Subject: rendered.subject,
      HtmlBody: rendered.html,
      TextBody: rendered.text,
      MessageStream:
        payload.stream === "broadcast"
          ? this.opts.broadcastStream
          : this.opts.transactionalStream,
      Tag: payload.template,
      Metadata: {
        outboxId: payload.outboxId,
        template: payload.template,
        ...(payload.userId ? { userId: payload.userId } : {}),
        ...(payload.flaggedAddress ? { flagged_address: "true" } : {}),
        ...(unsubscribeUrl ? { unsubscribe_token: tokenFromUrl(unsubscribeUrl) ?? "" } : {}),
      },
    };
    if (this.opts.replyTo) message.ReplyTo = this.opts.replyTo;
    if (unsubscribeUrl) {
      message.Headers = [
        { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ];
    }
    const result = await this.client.sendEmail(message);
    return { messageId: result.MessageID };
  }
}

function unsubscribeUrlFromVars(vars: unknown): string | null {
  if (!vars || typeof vars !== "object") return null;
  const value = (vars as Record<string, unknown>).unsubscribeUrl;
  return typeof value === "string" ? value : null;
}

function tokenFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("t");
  } catch {
    return null;
  }
}

export class ConsoleEmailSender implements IEmailSender {
  async send<T extends TemplateName>(payload: {
    outboxId: string;
    template: T;
    to: string;
    vars: TemplateVarsByName[T];
    stream: "transactional" | "broadcast";
    flaggedAddress: boolean;
  }): Promise<{ messageId: string }> {
    const rendered = await renderEmail(payload.template, payload.vars);
    console.info("[email:send]", {
      outboxId: payload.outboxId,
      template: payload.template,
      to: payload.to,
      stream: payload.stream,
      flaggedAddress: payload.flaggedAddress,
      subject: rendered.subject,
      preview: rendered.text.slice(0, 200),
    });
    return { messageId: `console-${payload.outboxId}` };
  }
}
