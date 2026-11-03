import type { Database } from "@auction/db";
import {
  enquiryRoutingRule,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  uploadObject,
} from "@auction/db/schema";
import {
  ENQUIRY_UPLOAD_KINDS,
  type EnquiryRoutingRule,
  isEnquiryUploadKind,
  planEnquiryAttachments,
} from "@auction/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  ClaimedEnquiryFiles,
  EnquiryNoteRecord,
  IEnquiryAttachmentRepository,
  IEnquiryNoteRepository,
  IEnquiryRoutingRepository,
} from "../interfaces/marketing-enquiry.repository.js";
import type { UploadOwner } from "../interfaces/upload-persistence.repository.js";

function toNote(row: typeof marketingEnquiryNote.$inferSelect): EnquiryNoteRecord {
  return {
    id: row.id,
    enquiryId: row.enquiryId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export class DrizzleEnquiryNoteRepository implements IEnquiryNoteRepository {
  constructor(private readonly db: Database) {}

  async addInTransaction(
    tx: Database,
    input: { enquiryId: string; authorUserId: string; body: string },
  ): Promise<EnquiryNoteRecord> {
    const [row] = await tx.insert(marketingEnquiryNote).values(input).returning();
    if (!row) throw new Error("enquiry note insert returned no row");
    return toNote(row);
  }

  async listForEnquiry(enquiryId: string): Promise<EnquiryNoteRecord[]> {
    const rows = await this.db
      .select()
      .from(marketingEnquiryNote)
      .where(eq(marketingEnquiryNote.enquiryId, enquiryId))
      .orderBy(asc(marketingEnquiryNote.createdAt), asc(marketingEnquiryNote.id));
    return rows.map(toNote);
  }
}

export class DrizzleEnquiryRoutingRepository implements IEnquiryRoutingRepository {
  constructor(private readonly db: Database) {}

  listRules(): Promise<EnquiryRoutingRule[]> {
    return this.listRulesInTransaction(this.db);
  }

  async listRulesInTransaction(tx: Database): Promise<EnquiryRoutingRule[]> {
    const rows = await tx
      .select({
        departmentSlug: enquiryRoutingRule.departmentSlug,
        assignedToUserId: enquiryRoutingRule.assignedToUserId,
      })
      .from(enquiryRoutingRule)
      .orderBy(asc(enquiryRoutingRule.departmentSlug));
    return rows;
  }

  async replaceRulesInTransaction(
    tx: Database,
    rules: readonly EnquiryRoutingRule[],
    updatedByUserId: string,
  ): Promise<void> {
    await tx.delete(enquiryRoutingRule);
    if (rules.length === 0) return;
    await tx.insert(enquiryRoutingRule).values(rules.map((rule) => ({ ...rule, updatedByUserId })));
  }
}

/** Attaches the files a sender uploaded to the enquiry they were sent with. */
export class DrizzleEnquiryAttachmentRepository implements IEnquiryAttachmentRepository {
  async claimInTransaction(
    tx: Database,
    input: { enquiryId: string; owner: UploadOwner; uploadIds: readonly string[] },
  ): Promise<ClaimedEnquiryFiles> {
    if (input.uploadIds.length === 0) return { images: 0, documents: 0 };
    const ownedBy =
      input.owner.enquiryDraftId !== undefined
        ? eq(uploadObject.enquiryDraftId, input.owner.enquiryDraftId)
        : eq(uploadObject.ownerUserId, input.owner.ownerUserId);
    const rows = await tx
      .select({ id: uploadObject.id, kind: uploadObject.kind, status: uploadObject.status })
      .from(uploadObject)
      .where(
        and(
          inArray(uploadObject.id, [...input.uploadIds]),
          inArray(uploadObject.kind, [...ENQUIRY_UPLOAD_KINDS]),
          ownedBy,
        ),
      );
    const byId = new Map(rows.map((row) => [row.id, row]));
    // Keep the order the sender chose; ids that are not theirs simply are not found.
    const ordered = input.uploadIds.flatMap((id) => {
      const row = byId.get(id);
      return row && isEnquiryUploadKind(row.kind)
        ? [{ id: row.id, kind: row.kind, status: row.status }]
        : [];
    });
    const { claimed } = planEnquiryAttachments(ordered);
    if (claimed.length === 0) return { images: 0, documents: 0 };
    // A file already attached to an enquiry stays with it; only new attachments are counted.
    const attached = await tx
      .insert(marketingEnquiryAttachment)
      .values(claimed.map((file) => ({ enquiryId: input.enquiryId, ...file })))
      .onConflictDoNothing()
      .returning({ kind: marketingEnquiryAttachment.kind });
    return {
      images: attached.filter((file) => file.kind === "image").length,
      documents: attached.filter((file) => file.kind === "document").length,
    };
  }
}
