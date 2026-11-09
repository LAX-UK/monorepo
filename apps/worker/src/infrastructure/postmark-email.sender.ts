import {
  type IEmailSender,
  type TemplateName,
  type TemplateVarsByName,
  emailAttachments,
  emailProductFor,
  renderEmail,
} from "@auction/email";
import postmark from "postmark";
import { fromForProduct } from "../alerts/sender-from.js";

type PostmarkEmailSenderOptions = {
  serverToken: string;
  from: string;
  /** Each product's From address; a product without an entry uses `from`. */
  fromByProduct?: Readonly<Record<string, string>> | undefined;
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
    const unsubscribeToken = postmarkMetadataUnsubscribeToken(unsubscribeUrl);
    const message: postmark.Message = {
      From: fromForProduct(
        emailProductFor(payload.template, payload.vars),
        this.opts.fromByProduct,
        this.opts.from,
      ),
      To: payload.to,
      Subject: rendered.subject,
      HtmlBody: rendered.html,
      TextBody: rendered.text,
      MessageStream:
        payload.stream === "broadcast" ? this.opts.broadcastStream : this.opts.transactionalStream,
      Tag: payload.template,
      Metadata: {
        outboxId: payload.outboxId,
        template: payload.template,
        ...(payload.userId ? { userId: payload.userId } : {}),
        ...(payload.flaggedAddress ? { flagged_address: "true" } : {}),
        ...(unsubscribeToken ? { unsubscribe_token: unsubscribeToken } : {}),
      },
    };
    const attachments = emailAttachments(payload.template, payload.vars);
    if (attachments.length > 0) {
      message.Attachments = attachments.map((file) => ({
        Name: file.name,
        Content: file.contentBase64,
        ContentType: file.contentType,
        ContentID: null,
      }));
    }
    if (this.opts.replyTo) message.ReplyTo = this.opts.replyTo;
    // The address a mail client POSTs to for one-click unsubscribe; by default the link in the body.
    const oneClickUrl = stringVar(payload.vars, "listUnsubscribeUrl") ?? unsubscribeUrl;
    if (oneClickUrl) {
      message.Headers = [
        { Name: "List-Unsubscribe", Value: `<${oneClickUrl}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ];
    }
    const result = await this.client.sendEmail(message);
    return { messageId: result.MessageID };
  }
}

function stringVar(vars: unknown, key: string): string | null {
  if (!vars || typeof vars !== "object") return null;
  const value = (vars as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function unsubscribeUrlFromVars(vars: unknown): string | null {
  return stringVar(vars, "unsubscribeUrl");
}

const POSTMARK_METADATA_VALUE_MAX_LEN = 80;

function tokenFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("t");
  } catch {
    return null;
  }
}

/** Postmark metadata values are limited to 80 characters. */
export function postmarkMetadataUnsubscribeToken(unsubscribeUrl: string | null): string | null {
  if (!unsubscribeUrl) return null;
  const token = tokenFromUrl(unsubscribeUrl);
  if (!token || token.length > POSTMARK_METADATA_VALUE_MAX_LEN) return null;
  return token;
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
