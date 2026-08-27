import type { Database } from "@auction/db";
import { category, user, userCategoryInterest } from "@auction/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  CategoryInterestsState,
  ICategoryInterestsRepository,
  ReplaceCategoryInterestsResult,
} from "../interfaces/category-interests.repository.js";

type CategoryInterestsTx = Pick<Database, "select" | "delete" | "insert" | "update">;

export class DrizzleCategoryInterestsRepository implements ICategoryInterestsRepository {
  constructor(private readonly db: Database) {}

  async getForUser(userId: string): Promise<CategoryInterestsState> {
    const rows = await this.db
      .select({
        categoryId: userCategoryInterest.categoryId,
        archived: category.archived,
        onboardingCompletedAt: user.categoryInterestsOnboardingCompletedAt,
      })
      .from(user)
      .leftJoin(userCategoryInterest, eq(userCategoryInterest.userId, user.id))
      .leftJoin(category, eq(category.id, userCategoryInterest.categoryId))
      .where(eq(user.id, userId))
      .orderBy(asc(userCategoryInterest.sortOrder), asc(userCategoryInterest.categoryId));

    if (rows.length === 0) {
      throw new Error("category interests user not found");
    }

    return {
      categoryIds: rows.flatMap((row) =>
        row.categoryId != null && row.archived !== true ? [row.categoryId] : [],
      ),
      onboardingCompletedAt: rows[0]?.onboardingCompletedAt ?? null,
    };
  }

  async replace(
    userId: string,
    categoryIds: readonly string[],
  ): Promise<ReplaceCategoryInterestsResult> {
    return this.db.transaction(async (tx) => {
      const [completionRow] = await tx
        .select({ onboardingCompletedAt: user.categoryInterestsOnboardingCompletedAt })
        .from(user)
        .where(eq(user.id, userId))
        .for("key share");
      if (!completionRow) throw new Error("category interests user not found");
      const replaced = await this.replaceCategoryRows(tx, userId, categoryIds);
      if (!replaced.ok) return replaced;
      return {
        ok: true as const,
        state: {
          categoryIds: replaced.categoryIds,
          onboardingCompletedAt: completionRow?.onboardingCompletedAt ?? null,
        },
      };
    });
  }

  async replaceAndComplete(
    userId: string,
    categoryIds: readonly string[],
  ): Promise<ReplaceCategoryInterestsResult> {
    return this.db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("key share");
      if (!lockedUser) throw new Error("category interests user not found");

      const replaced = await this.replaceCategoryRows(tx, userId, categoryIds);
      if (!replaced.ok) return replaced;

      const [completion] = await tx
        .update(user)
        .set({
          categoryInterestsOnboardingCompletedAt: sql`
            coalesce(${user.categoryInterestsOnboardingCompletedAt}, now())
          `,
        })
        .where(eq(user.id, userId))
        .returning({
          onboardingCompletedAt: user.categoryInterestsOnboardingCompletedAt,
        });
      if (!completion) throw new Error("category interests completion user not found");

      return {
        ok: true as const,
        state: {
          categoryIds: replaced.categoryIds,
          onboardingCompletedAt: completion.onboardingCompletedAt,
        },
      };
    });
  }

  private async replaceCategoryRows(
    tx: CategoryInterestsTx,
    userId: string,
    categoryIds: readonly string[],
  ): Promise<{ ok: true; categoryIds: string[] } | { ok: false; invalidCategoryIds: string[] }> {
    const uniqueIds = [...new Set(categoryIds)];
    const existingCategoryIds =
      uniqueIds.length === 0
        ? []
        : (
            await tx
              .select({ id: category.id })
              .from(category)
              .where(and(inArray(category.id, uniqueIds), eq(category.archived, false)))
          ).map((row) => row.id);
    const existing = new Set(existingCategoryIds);
    const invalidCategoryIds = uniqueIds.filter((id) => !existing.has(id));
    if (invalidCategoryIds.length > 0) {
      return { ok: false as const, invalidCategoryIds };
    }

    await tx.delete(userCategoryInterest).where(eq(userCategoryInterest.userId, userId));
    if (uniqueIds.length > 0) {
      await tx.insert(userCategoryInterest).values(
        uniqueIds.map((categoryId, sortOrder) => ({
          userId,
          categoryId,
          sortOrder,
        })),
      );
    }

    return { ok: true as const, categoryIds: uniqueIds };
  }
}
