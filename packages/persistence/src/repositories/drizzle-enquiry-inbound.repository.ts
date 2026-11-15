import type { Database } from "@auction/db";
import {
  emailOutbox,
  enquiryInboundQuarantine,
  marketingEnquiry,
  marketingEnquiryMessage,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  IEnquiryInboundRepository,
  InboundEnquiryTarget,
  NewInboundMessage,
  NewQuarantinedMessage,
} from "../interfaces/enquiry-inbound.repository.js";

const TARGET_COLUMNS = {
  id: marketingEnquiry.id,
  reference: marketingEnquiry.reference,
  intent: marketingEnquiry.intent,
  topic: marketingEnquiry.topic,
  name: marketingEnquiry.name,
  email: marketingEnquiry.email,
  status: marketingEnquiry.status,
};

export class DrizzleEnquiryInboundRepository implements IEnquiryInboundRepository {
  constructor(private readonly db: Database) {}

  async findTargetById(id: string): Promise<InboundEnquiryTarget | null> {
    const [row] = await this.db
      .select(TARGET_COLUMNS)
      .from(marketingEnquiry)
      .where(eq(marketingEnquiry.id, id))
      .limit(1);
    return row ?? null;
  }

  async findTargetByOutboundMessageIds(
    providerMessageIds: readonly string[],
  ): Promise<InboundEnquiryTarget | null> {
    if (providerMessageIds.length === 0) return null;
    const [row] = await this.db
      .select(TARGET_COLUMNS)
      .from(emailOutbox)
      .innerJoin(marketingEnquiryMessage, eq(marketingEnquiryMessage.outboxId, emailOutbox.id))
      .innerJoin(marketingEnquiry, eq(marketingEnquiry.id, marketingEnquiryMessage.enquiryId))
      .where(
        and(
          inArray(emailOutbox.messageId, [...providerMessageIds]),
          eq(marketingEnquiryMessage.direction, "outbound"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertInboundMessageInTransaction(
    tx: Database,
    input: NewInboundMessage,
  ): Promise<{ id: string } | null> {
    const [row] = await tx
      .insert(marketingEnquiryMessage)
      .values({
        enquiryId: input.enquiryId,
        direction: "inbound",
        sentByUserId: null,
        subject: input.subject,
        body: input.body,
        providerMessageId: input.providerMessageId,
        matchedBy: input.matchedBy,
        fromEmailHash: input.fromEmailHash,
        attachments: input.attachments,
        spfResult: input.spfResult,
        dkimResult: input.dkimResult,
      })
      .onConflictDoNothing()
      .returning({ id: marketingEnquiryMessage.id });
    return row ?? null;
  }

  async markAwaitingReplyInTransaction(tx: Database, enquiryId: string, at: Date): Promise<void> {
    await tx
      .update(marketingEnquiry)
      .set({
        awaitingReplySince: sql`COALESCE(${marketingEnquiry.awaitingReplySince}, ${at})`,
        status: sql`CASE WHEN ${marketingEnquiry.status} = 'waiting_on_client' THEN 'in_progress' ELSE ${marketingEnquiry.status} END`,
        version: sql`${marketingEnquiry.version} + 1`,
      })
      .where(eq(marketingEnquiry.id, enquiryId));
  }

  async insertQuarantineInTransaction(
    tx: Database,
    input: NewQuarantinedMessage,
  ): Promise<{ id: string } | null> {
    const [row] = await tx
      .insert(enquiryInboundQuarantine)
      .values({
        providerMessageId: input.providerMessageId,
        reason: input.reason,
        fromAddress: input.fromAddress,
        subject: input.subject,
        body: input.body,
        attachments: input.attachments,
        suspectedEnquiryId: input.suspectedEnquiryId ?? null,
        spfResult: input.spfResult,
        dkimResult: input.dkimResult,
      })
      .onConflictDoNothing()
      .returning({ id: enquiryInboundQuarantine.id });
    return row ?? null;
  }

  async isKnownProviderMessage(providerMessageId: string): Promise<boolean> {
    const [onThread] = await this.db
      .select({ id: marketingEnquiryMessage.id })
      .from(marketingEnquiryMessage)
      .where(eq(marketingEnquiryMessage.providerMessageId, providerMessageId))
      .limit(1);
    if (onThread) return true;
    const [held] = await this.db
      .select({ id: enquiryInboundQuarantine.id })
      .from(enquiryInboundQuarantine)
      .where(eq(enquiryInboundQuarantine.providerMessageId, providerMessageId))
      .limit(1);
    return Boolean(held);
  }
}
