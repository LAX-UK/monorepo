import type { Database } from "@auction/db";
import { shopStaffSavedView } from "@auction/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  CreateSavedViewInput,
  CreateSavedViewOutcome,
  RenameSavedViewOutcome,
  ReorderSavedViewsOutcome,
  SavedViewRecord,
  SavedViewRepository,
} from "../application/ports/saved-view.repository.js";

const columns = {
  id: shopStaffSavedView.id,
  listKey: shopStaffSavedView.listKey,
  label: shopStaffSavedView.label,
  query: shopStaffSavedView.query,
  position: shopStaffSavedView.position,
};

function isUniqueViolation(error: unknown): boolean {
  const e = (error as { code?: unknown; cause?: { code?: unknown } } | null) ?? {};
  return e.code === "23505" || e.cause?.code === "23505";
}

export function createDrizzleSavedViewRepository(db: Database): SavedViewRepository {
  const ownedBy = (ownerSubjectId: string, listKey: string) =>
    and(
      eq(shopStaffSavedView.ownerSubjectId, ownerSubjectId),
      eq(shopStaffSavedView.listKey, listKey),
    );

  /** Serialises writers for one person's list so the cap and the next position hold. */
  const lockList = (tx: Pick<Database, "execute">, ownerSubjectId: string, listKey: string) =>
    tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`shop_staff_saved_view:${ownerSubjectId}:${listKey}`}))`,
    );

  return {
    list(ownerSubjectId, listKey): Promise<SavedViewRecord[]> {
      return db
        .select(columns)
        .from(shopStaffSavedView)
        .where(ownedBy(ownerSubjectId, listKey))
        .orderBy(
          asc(shopStaffSavedView.position),
          asc(shopStaffSavedView.createdAt),
          asc(shopStaffSavedView.id),
        );
    },

    create(input: CreateSavedViewInput): Promise<CreateSavedViewOutcome> {
      const { ownerSubjectId, listKey } = input;
      return db.transaction(async (tx) => {
        await lockList(tx, ownerSubjectId, listKey);
        const [stats] = await tx
          .select({
            total: sql<number>`count(*)::int`,
            next: sql<number>`coalesce(max(${shopStaffSavedView.position}) + 1, 0)::int`,
          })
          .from(shopStaffSavedView)
          .where(ownedBy(ownerSubjectId, listKey));
        if ((stats?.total ?? 0) >= input.maxPerList) return { status: "limit_reached" as const };
        const [row] = await tx
          .insert(shopStaffSavedView)
          .values({
            ownerSubjectId,
            listKey,
            label: input.label,
            query: input.query,
            position: stats?.next ?? 0,
          })
          .onConflictDoNothing({
            target: [
              shopStaffSavedView.ownerSubjectId,
              shopStaffSavedView.listKey,
              shopStaffSavedView.label,
            ],
          })
          .returning(columns);
        return row
          ? { status: "created" as const, view: row }
          : { status: "duplicate_label" as const };
      });
    },

    async rename(ownerSubjectId, id, label): Promise<RenameSavedViewOutcome> {
      try {
        const [row] = await db
          .update(shopStaffSavedView)
          .set({ label, updatedAt: new Date() })
          .where(
            and(
              eq(shopStaffSavedView.id, id),
              eq(shopStaffSavedView.ownerSubjectId, ownerSubjectId),
            ),
          )
          .returning(columns);
        return row ? { status: "renamed", view: row } : { status: "not_found" };
      } catch (error) {
        if (isUniqueViolation(error)) return { status: "duplicate_label" };
        throw error;
      }
    },

    reorder(ownerSubjectId, listKey, ids): Promise<ReorderSavedViewsOutcome> {
      return db.transaction(async (tx) => {
        await lockList(tx, ownerSubjectId, listKey);
        const current = await tx
          .select({ id: shopStaffSavedView.id })
          .from(shopStaffSavedView)
          .where(ownedBy(ownerSubjectId, listKey));
        const known = new Set(current.map((row) => row.id));
        if (
          new Set(ids).size !== ids.length ||
          ids.length !== known.size ||
          ids.some((id) => !known.has(id))
        ) {
          return { status: "mismatch" as const };
        }
        for (const [position, id] of ids.entries()) {
          await tx
            .update(shopStaffSavedView)
            .set({ position, updatedAt: new Date() })
            .where(
              and(
                eq(shopStaffSavedView.id, id),
                eq(shopStaffSavedView.ownerSubjectId, ownerSubjectId),
              ),
            );
        }
        const views = await tx
          .select(columns)
          .from(shopStaffSavedView)
          .where(ownedBy(ownerSubjectId, listKey))
          .orderBy(asc(shopStaffSavedView.position));
        return { status: "reordered" as const, views };
      });
    },

    async remove(ownerSubjectId, id): Promise<boolean> {
      const rows = await db
        .delete(shopStaffSavedView)
        .where(
          and(eq(shopStaffSavedView.id, id), eq(shopStaffSavedView.ownerSubjectId, ownerSubjectId)),
        )
        .returning({ id: shopStaffSavedView.id });
      return rows.length > 0;
    },
  };
}
