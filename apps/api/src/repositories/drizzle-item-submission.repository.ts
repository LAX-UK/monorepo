import type { Database } from "@auction/db";
import { itemSubmission, submissionCategories } from "@auction/db/schema";
import type { CreateItemSubmissionInput } from "@auction/types";
import { type InferInsertModel, and, asc, count, desc, eq, ilike, inArray } from "drizzle-orm";
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
  if (f.q?.trim()) {
    const safe = f.q
      .trim()
      .slice(0, 200)
      .replace(/[%_\\]/g, "");
    if (safe.length > 0) parts.push(ilike(itemSubmission.title, `%${safe}%`));
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleItemSubmissionRepository implements IItemSubmissionRepository {
  constructor(private readonly db: Database) {}

  private async categoryIdsBySubmissionIds(ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        submissionId: submissionCategories.submissionId,
        categoryId: submissionCategories.categoryId,
      })
      .from(submissionCategories)
      .where(inArray(submissionCategories.submissionId, ids))
      .orderBy(asc(submissionCategories.sortOrder));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const arr = map.get(row.submissionId) ?? [];
      arr.push(row.categoryId);
      map.set(row.submissionId, arr);
    }
    return map;
  }

  private async withCategoryIds(
    rows: (typeof itemSubmission.$inferSelect)[],
  ): Promise<ReturnType<typeof mapItemSubmissionRow>[]> {
    const categoriesBySubmission = await this.categoryIdsBySubmissionIds(rows.map((row) => row.id));
    return rows.map((row) => mapItemSubmissionRow(row, categoriesBySubmission.get(row.id) ?? []));
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(itemSubmission)
      .where(eq(itemSubmission.id, id))
      .limit(1);
    if (!row) return null;
    const categories = await this.categoryIdsBySubmissionIds([row.id]);
    return mapItemSubmissionRow(row, categories.get(row.id) ?? []);
  }

  async create(sellerId: string, input: CreateItemSubmissionInput) {
    const now = new Date();
    const categoryIds = input.categoryIds ?? (input.categoryId ? [input.categoryId] : []);
    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(itemSubmission)
        .values({
          sellerId,
          title: input.title,
          description: input.description ?? null,
          medium: input.medium ?? null,
          dimensions: input.dimensions ?? null,
          images: input.images ?? [],
          yearOfWork: input.yearOfWork ?? null,
          isSigned: input.isSigned ?? false,
          signatureNote: input.signatureNote ?? null,
          edition: input.edition ?? null,
          conditionSelfReport: input.conditionSelfReport ?? null,
          provenance: input.provenance ?? [],
          exhibitions: input.exhibitions ?? [],
          askingPrice: input.askingPrice ?? null,
          reservePrice: input.reservePrice ?? null,
          submitterNotes: input.submitterNotes ?? null,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw new Error("item_submission insert failed");
      if (categoryIds.length > 0) {
        await tx.insert(submissionCategories).values(
          categoryIds.map((categoryId, index) => ({
            submissionId: created.id,
            categoryId,
            sortOrder: index,
          })),
        );
      }
      return created;
    });
    return mapItemSubmissionRow(row, categoryIds);
  }

  async update(id: string, patch: ItemSubmissionUpdatePatch) {
    type Insert = InferInsertModel<typeof itemSubmission>;
    const rowPatch: Partial<Insert> = { updatedAt: new Date() };
    if (patch.title !== undefined) rowPatch.title = patch.title;
    if (patch.description !== undefined) rowPatch.description = patch.description;
    if (patch.medium !== undefined) rowPatch.medium = patch.medium;
    if (patch.dimensions !== undefined) rowPatch.dimensions = patch.dimensions;
    if (patch.images !== undefined) rowPatch.images = patch.images;
    if (patch.yearOfWork !== undefined) rowPatch.yearOfWork = patch.yearOfWork;
    if (patch.isSigned !== undefined) rowPatch.isSigned = patch.isSigned;
    if (patch.signatureNote !== undefined) rowPatch.signatureNote = patch.signatureNote;
    if (patch.edition !== undefined) rowPatch.edition = patch.edition;
    if (patch.conditionSelfReport !== undefined)
      rowPatch.conditionSelfReport = patch.conditionSelfReport;
    if (patch.provenance !== undefined) rowPatch.provenance = patch.provenance;
    if (patch.exhibitions !== undefined) rowPatch.exhibitions = patch.exhibitions;
    if (patch.askingPrice !== undefined) rowPatch.askingPrice = patch.askingPrice;
    if (patch.reservePrice !== undefined) rowPatch.reservePrice = patch.reservePrice;
    const categoryIds =
      patch.categoryIds !== undefined
        ? patch.categoryIds
        : patch.categoryId
          ? [patch.categoryId]
          : undefined;
    if (patch.submitterNotes !== undefined) rowPatch.submitterNotes = patch.submitterNotes;
    if (patch.status !== undefined) rowPatch.status = patch.status;
    if (patch.reviewedBy !== undefined) rowPatch.reviewedBy = patch.reviewedBy;
    if (patch.reviewedAt !== undefined) rowPatch.reviewedAt = patch.reviewedAt;
    if (patch.reviewNotes !== undefined) rowPatch.reviewNotes = patch.reviewNotes;
    if (patch.rejectionReason !== undefined) rowPatch.rejectionReason = patch.rejectionReason;
    if (patch.convertedLotId !== undefined) rowPatch.convertedLotId = patch.convertedLotId;

    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(itemSubmission)
        .set(rowPatch)
        .where(eq(itemSubmission.id, id))
        .returning();
      if (!updated) throw new Error("item_submission update failed");
      if (categoryIds !== undefined) {
        await tx.delete(submissionCategories).where(eq(submissionCategories.submissionId, id));
        if (categoryIds.length > 0) {
          await tx.insert(submissionCategories).values(
            categoryIds.map((categoryId, index) => ({
              submissionId: id,
              categoryId,
              sortOrder: index,
            })),
          );
        }
      }
      return updated;
    });
    const categories = await this.categoryIdsBySubmissionIds([row.id]);
    return mapItemSubmissionRow(row, categories.get(row.id) ?? []);
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
    return this.withCategoryIds(rows);
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
    return this.withCategoryIds(rows);
  }

  async countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">) {
    const where = adminWhere(f);
    const q = this.db.select({ n: count() }).from(itemSubmission);
    const [row] = where ? await q.where(where) : await q;
    return Number(row?.n ?? 0);
  }
}
