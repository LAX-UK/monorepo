import type { Database } from "@auction/db";
import { enquiryRoutingRule, marketingEnquiryNote } from "@auction/db/schema";
import type { EnquiryRoutingRule } from "@auction/domain";
import { asc, eq } from "drizzle-orm";
import type {
  EnquiryNoteRecord,
  IEnquiryNoteRepository,
  IEnquiryRoutingRepository,
} from "../interfaces/marketing-enquiry.repository.js";

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
