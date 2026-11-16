import { emailHash } from "@auction/email";
import type {
  IEnquiryInboundRepository,
  ITransactionRunner,
  InboundAttachmentMetadata,
  InboundEnquiryTarget,
  NewQuarantinedMessage,
} from "@auction/persistence/interfaces";
import { z } from "zod";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { EnquiryReplyAddresses } from "./enquiry-reply-address.js";
import {
  INBOUND_BODY_MAX_CHARS,
  INBOUND_FILENAME_MAX_CHARS,
  INBOUND_SUBJECT_MAX_CHARS,
  messageIdsFromHeader,
  providerIdFromMessageId,
  sanitiseInboundLine,
  sanitiseInboundText,
} from "./inbound-text.js";

const ENQUIRY = "marketing_enquiry" as const;
const MAX_ATTACHMENTS_KEPT = 20;

const addressSchema = z.object({ Email: z.string().max(320).optional() }).passthrough();

/** The parts of Postmark's inbound JSON this service reads. Everything else is ignored. */
export const inboundPayloadSchema = z
  .object({
    MessageID: z.string().min(1).max(200),
    From: z.string().max(1000).optional(),
    FromFull: addressSchema.optional(),
    ToFull: z.array(addressSchema).max(50).optional(),
    CcFull: z.array(addressSchema).max(50).optional(),
    To: z.string().max(5000).optional(),
    OriginalRecipient: z.string().max(500).optional(),
    MailboxHash: z.string().max(200).optional(),
    Subject: z.string().max(5000).optional(),
    TextBody: z.string().optional(),
    HtmlBody: z.string().optional(),
    StrippedTextReply: z.string().optional(),
    Headers: z
      .array(z.object({ Name: z.string().max(200), Value: z.string().max(10_000) }).passthrough())
      .max(500)
      .optional(),
    Attachments: z
      .array(
        z
          .object({
            Name: z.string().max(1000).optional(),
            ContentType: z.string().max(300).optional(),
            ContentLength: z.number().optional(),
          })
          // `Content` (the file, base64) is deliberately not part of the schema: it is dropped.
          .passthrough(),
      )
      .max(500)
      .optional(),
  })
  .passthrough();

export type InboundPayload = z.infer<typeof inboundPayloadSchema>;

export type InboundOutcome =
  | { outcome: "stored"; messageId: string; enquiryId: string }
  | { outcome: "duplicate" }
  | { outcome: "quarantined"; reason: NewQuarantinedMessage["reason"] };

/** Tells staff a sender replied. Separate from the new-enquiry alert so each stays small. */
export interface IEnquiryReplyAlert {
  notifyReply(
    enquiry: InboundEnquiryTarget,
    reply: { messageId: string; text: string },
  ): Promise<void>;
}

export const noEnquiryReplyAlert: IEnquiryReplyAlert = { async notifyReply() {} };

export type EnquiryInboundReplyDeps = {
  repository: IEnquiryInboundRepository;
  addresses: EnquiryReplyAddresses;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  alert: IEnquiryReplyAlert;
  now: () => Date;
  /** Called with ids and codes only, never an address or any text of the mail. */
  onAlertFailed?: (enquiryId: string, error: unknown) => void;
};

function header(payload: InboundPayload, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return payload.Headers?.find((h) => h.Name.toLowerCase() === wanted)?.Value;
}

function emailOf(value: string | undefined): string {
  if (!value) return "";
  const angle = /<([^<>\s]+)>/.exec(value);
  return (angle?.[1] ?? value).trim().toLowerCase();
}

/** An automatic reply (out of office, bounce, list mail) is not a person writing back. */
function isAutomatic(payload: InboundPayload): boolean {
  const auto = header(payload, "Auto-Submitted")?.trim().toLowerCase();
  if (auto && auto !== "no") return true;
  const precedence = header(payload, "Precedence")?.trim().toLowerCase();
  if (precedence && ["bulk", "junk", "auto_reply", "list"].includes(precedence)) return true;
  return (
    header(payload, "X-Autoreply") !== undefined || header(payload, "X-Autorespond") !== undefined
  );
}

/** Postmark records the sender policy check of the receiving server in Received-SPF. */
function spfFailed(payload: InboundPayload): boolean {
  const spf = header(payload, "Received-SPF")?.trim().toLowerCase();
  return Boolean(spf && /^(fail|softfail)\b/.test(spf));
}

/**
 * Takes one mail from the Postmark inbound webhook and either adds it to the enquiry thread it
 * answers or holds it in quarantine. A reply joins a thread only when its address (or, failing
 * that, a message id it quotes) names the thread AND it comes from the person who enquired AND it
 * is not an automatic reply or an SPF failure. Anything else is held for staff and never attached.
 * Attachments are recorded as metadata (name, type, size); the files are not stored.
 */
export class EnquiryInboundReplyService {
  constructor(private readonly deps: EnquiryInboundReplyDeps) {}

  async handle(payload: InboundPayload): Promise<InboundOutcome> {
    const providerMessageId = payload.MessageID;
    if (await this.deps.repository.isKnownProviderMessage(providerMessageId)) {
      return { outcome: "duplicate" };
    }

    const fromAddress = emailOf(payload.FromFull?.Email ?? payload.From);
    const subject = sanitiseInboundLine(payload.Subject, INBOUND_SUBJECT_MAX_CHARS);
    const body = sanitiseInboundText(
      payload.StrippedTextReply?.trim() || payload.TextBody?.trim() || payload.HtmlBody || "",
      INBOUND_BODY_MAX_CHARS,
    );
    const attachments = this.attachmentMetadata(payload);
    const held = {
      providerMessageId,
      fromAddress: fromAddress.slice(0, 320),
      subject,
      body,
      attachments,
    };

    const recipients = [
      ...(payload.ToFull ?? []).map((a) => a.Email ?? ""),
      ...(payload.CcFull ?? []).map((a) => a.Email ?? ""),
      payload.OriginalRecipient ?? "",
    ].filter(Boolean);
    const byAddress = this.deps.addresses.match({
      addresses: recipients,
      mailboxHash: payload.MailboxHash,
    });

    if (byAddress.kind === "invalid") return this.quarantine({ ...held, reason: "bad_token" });

    let target: InboundEnquiryTarget | null = null;
    let matchedBy: "token" | "in_reply_to" = "token";
    if (byAddress.kind === "valid") {
      target = await this.deps.repository.findTargetById(byAddress.enquiryId);
      if (!target) return this.quarantine({ ...held, reason: "unmatched" });
    } else {
      const quoted = [
        ...messageIdsFromHeader(header(payload, "In-Reply-To")),
        ...messageIdsFromHeader(header(payload, "References")),
      ].map(providerIdFromMessageId);
      target = await this.deps.repository.findTargetByOutboundMessageIds(quoted);
      matchedBy = "in_reply_to";
      if (!target) return this.quarantine({ ...held, reason: "unmatched" });
    }

    const suspect = { suspectedEnquiryId: target.id };
    if (isAutomatic(payload)) return this.quarantine({ ...held, ...suspect, reason: "auto_reply" });
    if (spfFailed(payload)) return this.quarantine({ ...held, ...suspect, reason: "spf_failed" });
    if (!fromAddress || fromAddress !== target.email.trim().toLowerCase()) {
      return this.quarantine({ ...held, ...suspect, reason: "sender_mismatch" });
    }

    const stored = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const row = await this.deps.repository.insertInboundMessageInTransaction(tx, {
        enquiryId: target.id,
        providerMessageId,
        matchedBy,
        fromEmailHash: emailHash(fromAddress),
        subject,
        body,
        attachments,
      });
      if (!row) return null;
      await this.deps.repository.markAwaitingReplyInTransaction(tx, target.id, this.deps.now());
      await this.deps.events.withTx(tx).publish({
        aggregateType: ENQUIRY,
        aggregateId: target.id,
        eventType: "marketing_enquiry.customer_replied",
        payload: {
          enquiryId: target.id,
          intent: target.intent,
          messageId: row.id,
          matchedBy,
          attachmentCount: attachments.length,
        },
      });
      return row;
    });
    if (!stored) return { outcome: "duplicate" };

    // The reply is stored and the thread flagged; a failed email must not lose it or make
    // Postmark redeliver it.
    try {
      await this.deps.alert.notifyReply(target, { messageId: stored.id, text: body });
    } catch (error) {
      this.deps.onAlertFailed?.(target.id, error);
    }
    return { outcome: "stored", messageId: stored.id, enquiryId: target.id };
  }

  private attachmentMetadata(payload: InboundPayload): InboundAttachmentMetadata[] {
    return (payload.Attachments ?? []).slice(0, MAX_ATTACHMENTS_KEPT).map((a) => ({
      name: sanitiseInboundLine(a.Name, INBOUND_FILENAME_MAX_CHARS) || "attachment",
      contentType: sanitiseInboundLine(a.ContentType, 100) || "application/octet-stream",
      sizeBytes:
        typeof a.ContentLength === "number" &&
        Number.isFinite(a.ContentLength) &&
        a.ContentLength >= 0
          ? Math.floor(a.ContentLength)
          : 0,
    }));
  }

  private async quarantine(input: NewQuarantinedMessage): Promise<InboundOutcome> {
    const row = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const created = await this.deps.repository.insertQuarantineInTransaction(tx, input);
      if (!created) return null;
      await this.deps.events.withTx(tx).publish({
        aggregateType: "enquiry_inbound_quarantine",
        aggregateId: created.id,
        eventType: "marketing_enquiry.inbound_quarantined",
        payload: {
          quarantineId: created.id,
          reason: input.reason,
          attachmentCount: input.attachments.length,
        },
      });
      return created;
    });
    return row ? { outcome: "quarantined", reason: input.reason } : { outcome: "duplicate" };
  }
}
