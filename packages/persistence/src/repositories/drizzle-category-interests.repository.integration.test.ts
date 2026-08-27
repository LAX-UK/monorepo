import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { category, user, userCategoryInterest } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleCategoryInterestsRepository } from "./drizzle-category-interests.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleCategoryInterestsRepository (integration)", () => {
  it("replaces interests atomically, records first completion, and hides archived IDs", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const userId = `category-interests-${randomUUID()}`;
    const firstCategoryId = randomUUID();
    const secondCategoryId = randomUUID();
    const archivedCategoryId = randomUUID();
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: "Interests Buyer",
          email: `${userId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(category).values([
          {
            id: firstCategoryId,
            name: "Art",
            slug: `art-${firstCategoryId.slice(0, 8)}`,
            archived: false,
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: secondCategoryId,
            name: "Jewellery",
            slug: `jewellery-${secondCategoryId.slice(0, 8)}`,
            archived: false,
            sortOrder: 2,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: archivedCategoryId,
            name: "Archived",
            slug: `archived-${archivedCategoryId.slice(0, 8)}`,
            archived: true,
            sortOrder: 3,
            createdAt: now,
            updatedAt: now,
          },
        ]);

        const repo = new DrizzleCategoryInterestsRepository(tx);

        await expect(
          repo.replaceAndComplete(userId, [secondCategoryId, firstCategoryId, archivedCategoryId]),
        ).resolves.toEqual({ ok: false, invalidCategoryIds: [archivedCategoryId] });
        await expect(repo.getForUser(userId)).resolves.toEqual({
          categoryIds: [],
          onboardingCompletedAt: null,
        });

        const firstComplete = await repo.replaceAndComplete(userId, [
          secondCategoryId,
          firstCategoryId,
        ]);
        expect(firstComplete).toMatchObject({
          ok: true,
          state: { categoryIds: [secondCategoryId, firstCategoryId] },
        });
        if (!firstComplete.ok) throw new Error("expected first completion");
        expect(firstComplete.state.onboardingCompletedAt).toBeInstanceOf(Date);

        const secondComplete = await repo.replaceAndComplete(userId, [firstCategoryId]);
        expect(secondComplete).toEqual({
          ok: true,
          state: {
            categoryIds: [firstCategoryId],
            onboardingCompletedAt: firstComplete.state.onboardingCompletedAt,
          },
        });

        await tx.insert(userCategoryInterest).values({
          userId,
          categoryId: archivedCategoryId,
          sortOrder: 1,
        });
        await expect(repo.getForUser(userId)).resolves.toEqual({
          categoryIds: [firstCategoryId],
          onboardingCompletedAt: firstComplete.state.onboardingCompletedAt,
        });

        const replaced = await repo.replace(userId, [secondCategoryId]);
        expect(replaced).toEqual({
          ok: true,
          state: {
            categoryIds: [secondCategoryId],
            onboardingCompletedAt: firstComplete.state.onboardingCompletedAt,
          },
        });
        const remaining = await tx
          .select({ categoryId: userCategoryInterest.categoryId })
          .from(userCategoryInterest)
          .where(eq(userCategoryInterest.userId, userId));
        expect(remaining.map((row) => row.categoryId)).toEqual([secondCategoryId]);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
