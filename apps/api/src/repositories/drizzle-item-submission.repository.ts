import type { Database } from "@auction/db";
import { itemSubmission } from "@auction/db/schema";
import type { CreateItemSubmissionInput } from "@auction/types";
import { type InferInsertModel, and, count, desc, eq } from "drizzle-orm";
import { mapItemSubmissionRow } from "../lib/mappers.js";
import type {
  IItemSubmissionRepository,
  ItemSubmissionUpdatePatch,
  ListSubmissionsFilter,
} from "../services/interfaces/repositories.js";

function adminWhere(f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
  const parts = [];
  if (f.status) parts.push(eq(itemSubmission.status, f.status));
  if (f.sellerId) parts.push(eq(itemSubmission.sellerId, f.sellerId));
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleItemSubmissionRepository implements IItemSubmissionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(itemSubmission)
      .where(eq(itemSubmission.id, id))
      .limit(1);
    return row ? mapItemSubmissionRow(row) : null;
  }

  async create(sellerId: string, input: CreateItemSubmissionInput) {
    const now = new Date();
    const [row] = await this.db
      .insert(itemSubmission)
      .values({
        sellerId,
        title: input.title,
        description: input.description ?? null,
        medium: input.medium ?? null,
        dimensions: input.dimensions ?? null,
        images: input.images ?? [],
        askingPrice: input.askingPrice ?? null,
        reservePrice: input.reservePrice ?? null,
        categoryId: input.categoryId,
        submitterNotes: input.submitterNotes ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) throw new Error("item_submission insert failed");
    return mapItemSubmissionRow(row);
  }

  async update(id: string, patch: ItemSubmissionUpdatePatch) {
    type Insert = InferInsertModel<typeof itemSubmission>;
    const rowPatch: Partial<Insert> = { updatedAt: new Date() };
    if (patch.title !== undefined) rowPatch.title = patch.title;
    if (patch.description !== undefined) rowPatch.description = patch.description;
    if (patch.medium !== undefined) rowPatch.medium = patch.medium;
    if (patch.dimensions !== undefined) rowPatch.dimensions = patch.dimensions;
    if (patch.images !== undefined) rowPatch.images = patch.images;
    if (patch.askingPrice !== undefined) rowPatch.askingPrice = patch.askingPrice;
    if (patch.reservePrice !== undefined) rowPatch.reservePrice = patch.reservePrice;
    if (patch.categoryId !== undefined) rowPatch.categoryId = patch.categoryId;
    if (patch.submitterNotes !== undefined) rowPatch.submitterNotes = patch.submitterNotes;
    if (patch.status !== undefined) rowPatch.status = patch.status;
    if (patch.reviewedBy !== undefined) rowPatch.reviewedBy = patch.reviewedBy;
    if (patch.reviewedAt !== undefined) rowPatch.reviewedAt = patch.reviewedAt;
    if (patch.reviewNotes !== undefined) rowPatch.reviewNotes = patch.reviewNotes;
    if (patch.rejectionReason !== undefined) rowPatch.rejectionReason = patch.rejectionReason;
    if (patch.convertedLotId !== undefined) rowPatch.convertedLotId = patch.convertedLotId;

    const [row] = await this.db
      .update(itemSubmission)
      .set(rowPatch)
      .where(eq(itemSubmission.id, id))
      .returning();
    if (!row) throw new Error("item_submission update failed");
    return mapItemSubmissionRow(row);
  }

  async listForSeller(sellerId: string, f: ListSubmissionsFilter) {
    const parts = [eq(itemSubmission.sellerId, sellerId)];
    if (f.status) parts.push(eq(itemSubmission.status, f.status));
    const where = and(...parts);
    const rows = await this.db
      .select()
      .from(itemSubmission)
      .where(where)
      .orderBy(desc(itemSubmission.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    return rows.map(mapItemSubmissionRow);
  }

  async listForAdmin(f: ListSubmissionsFilter) {
    const where = adminWhere(f);
    const base = this.db
      .select()
      .from(itemSubmission)
      .orderBy(desc(itemSubmission.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    const rows = where ? await base.where(where) : await base;
    return rows.map(mapItemSubmissionRow);
  }

  async countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
    const where = adminWhere(f);
    const q = this.db.select({ n: count() }).from(itemSubmission);
    const [row] = where ? await q.where(where) : await q;
    return Number(row?.n ?? 0);
  }
}
