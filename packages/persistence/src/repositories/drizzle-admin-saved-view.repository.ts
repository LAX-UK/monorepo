import type { Database } from "@auction/db";
import { adminSavedView } from "@auction/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  AdminSavedViewRecord,
  CreateAdminSavedViewInput,
  CreateAdminSavedViewResult,
  IAdminSavedViewRepository,
  RenameAdminSavedViewResult,
  ReorderAdminSavedViewsResult,
} from "../interfaces/admin-saved-view.repository.js";

const columns = {
  id: adminSavedView.id,
  listKey: adminSavedView.listKey,
  label: adminSavedView.label,
  query: adminSavedView.query,
  position: adminSavedView.position,
};

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } } | null) ?? {};
  return code.code === "23505" || code.cause?.code === "23505";
}

export class DrizzleAdminSavedViewRepository implements IAdminSavedViewRepository {
  constructor(private readonly db: Database) {}

  list(ownerSubjectId: string, listKey: string): Promise<AdminSavedViewRecord[]> {
    return this.db
      .select(columns)
      .from(adminSavedView)
      .where(
        and(eq(adminSavedView.ownerSubjectId, ownerSubjectId), eq(adminSavedView.listKey, listKey)),
      )
      .orderBy(asc(adminSavedView.position), asc(adminSavedView.createdAt), asc(adminSavedView.id));
  }

  async create(input: CreateAdminSavedViewInput): Promise<CreateAdminSavedViewResult> {
    const { ownerSubjectId, listKey } = input;
    return this.db.transaction(async (tx) => {
      // Serialises writers for one person's list so the cap and the next position hold.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`admin_saved_view:${ownerSubjectId}:${listKey}`}))`,
      );
      const [stats] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          next: sql<number>`coalesce(max(${adminSavedView.position}) + 1, 0)::int`,
        })
        .from(adminSavedView)
        .where(
          and(
            eq(adminSavedView.ownerSubjectId, ownerSubjectId),
            eq(adminSavedView.listKey, listKey),
          ),
        );
      if ((stats?.total ?? 0) >= input.maxPerList) return { status: "limit_reached" };
      const [row] = await tx
        .insert(adminSavedView)
        .values({
          ownerSubjectId,
          listKey,
          label: input.label,
          query: input.query,
          position: stats?.next ?? 0,
        })
        .onConflictDoNothing({
          target: [adminSavedView.ownerSubjectId, adminSavedView.listKey, adminSavedView.label],
        })
        .returning(columns);
      return row ? { status: "created", view: row } : { status: "duplicate_label" };
    });
  }

  async rename(
    ownerSubjectId: string,
    id: string,
    label: string,
  ): Promise<RenameAdminSavedViewResult> {
    try {
      const [row] = await this.db
        .update(adminSavedView)
        .set({ label, updatedAt: new Date() })
        .where(and(eq(adminSavedView.id, id), eq(adminSavedView.ownerSubjectId, ownerSubjectId)))
        .returning(columns);
      return row ? { status: "renamed", view: row } : { status: "not_found" };
    } catch (error) {
      if (isUniqueViolation(error)) return { status: "duplicate_label" };
      throw error;
    }
  }

  async reorder(
    ownerSubjectId: string,
    listKey: string,
    ids: readonly string[],
  ): Promise<ReorderAdminSavedViewsResult> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`admin_saved_view:${ownerSubjectId}:${listKey}`}))`,
      );
      const current = await tx
        .select({ id: adminSavedView.id })
        .from(adminSavedView)
        .where(
          and(
            eq(adminSavedView.ownerSubjectId, ownerSubjectId),
            eq(adminSavedView.listKey, listKey),
          ),
        );
      const known = new Set(current.map((row) => row.id));
      const unique = new Set(ids);
      if (
        unique.size !== ids.length ||
        unique.size !== known.size ||
        ids.some((id) => !known.has(id))
      ) {
        return { status: "mismatch" };
      }
      for (const [position, id] of ids.entries()) {
        await tx
          .update(adminSavedView)
          .set({ position, updatedAt: new Date() })
          .where(and(eq(adminSavedView.id, id), eq(adminSavedView.ownerSubjectId, ownerSubjectId)));
      }
      const views = await tx
        .select(columns)
        .from(adminSavedView)
        .where(
          and(
            eq(adminSavedView.ownerSubjectId, ownerSubjectId),
            eq(adminSavedView.listKey, listKey),
          ),
        )
        .orderBy(asc(adminSavedView.position));
      return { status: "reordered", views };
    });
  }

  async remove(ownerSubjectId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(adminSavedView)
      .where(and(eq(adminSavedView.id, id), eq(adminSavedView.ownerSubjectId, ownerSubjectId)))
      .returning({ id: adminSavedView.id });
    return rows.length > 0;
  }
}
