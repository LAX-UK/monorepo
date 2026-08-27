import { userCategoryInterest } from "@auction/db/schema";
import { describe, expect, it, vi } from "vitest";
import { DrizzleCategoryInterestsRepository } from "./drizzle-category-interests.repository.js";

const firstCategoryId = "11111111-1111-4111-8111-111111111111";
const secondCategoryId = "22222222-2222-4222-8222-222222222222";

describe("DrizzleCategoryInterestsRepository", () => {
  it("reads category IDs in stored order with the completion marker", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const orderBy = vi.fn().mockResolvedValue([
      { categoryId: secondCategoryId, archived: false, onboardingCompletedAt: completedAt },
      { categoryId: firstCategoryId, archived: false, onboardingCompletedAt: completedAt },
    ]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const query = { leftJoin: vi.fn(), where };
    query.leftJoin.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    const select = vi.fn().mockReturnValue({ from });
    const repository = new DrizzleCategoryInterestsRepository({ select } as never);

    await expect(repository.getForUser("u1")).resolves.toEqual({
      categoryIds: [secondCategoryId, firstCategoryId],
      onboardingCompletedAt: completedAt,
    });
  });

  it("returns a stable incomplete state when the user row exists without interests", async () => {
    const orderBy = vi
      .fn()
      .mockResolvedValue([{ categoryId: null, archived: null, onboardingCompletedAt: null }]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const query = { leftJoin: vi.fn(), where };
    query.leftJoin.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    const repository = new DrizzleCategoryInterestsRepository({
      select: vi.fn().mockReturnValue({ from }),
    } as never);

    await expect(repository.getForUser("u1")).resolves.toEqual({
      categoryIds: [],
      onboardingCompletedAt: null,
    });
  });

  it("throws when the user row is missing", async () => {
    const orderBy = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const query = { leftJoin: vi.fn(), where };
    query.leftJoin.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    const repository = new DrizzleCategoryInterestsRepository({
      select: vi.fn().mockReturnValue({ from }),
    } as never);

    await expect(repository.getForUser("missing")).rejects.toThrow(
      "category interests user not found",
    );
  });

  it("omits archived categories from the active selection", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const orderBy = vi.fn().mockResolvedValue([
      { categoryId: firstCategoryId, archived: false, onboardingCompletedAt: completedAt },
      { categoryId: secondCategoryId, archived: true, onboardingCompletedAt: completedAt },
    ]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const query = { leftJoin: vi.fn(), where };
    query.leftJoin.mockReturnValue(query);
    const repository = new DrizzleCategoryInterestsRepository({
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(query) }),
    } as never);

    await expect(repository.getForUser("u1")).resolves.toEqual({
      categoryIds: [firstCategoryId],
      onboardingCompletedAt: completedAt,
    });
  });

  it("replaces interests without changing onboarding completion", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const categoryWhere = vi
      .fn()
      .mockResolvedValue([{ id: firstCategoryId }, { id: secondCategoryId }]);
    const categoryFrom = vi.fn().mockReturnValue({ where: categoryWhere });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const lockFor = vi.fn().mockResolvedValue([{ onboardingCompletedAt: completedAt }]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({ from: userFrom })
        .mockReturnValueOnce({ from: categoryFrom }),
      delete: deleteFrom,
      insert,
      update: vi.fn(),
    };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(repository.replace("u1", [firstCategoryId])).resolves.toEqual({
      ok: true,
      state: {
        categoryIds: [firstCategoryId],
        onboardingCompletedAt: completedAt,
      },
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("replaces only the user's interest rows and never mutates the category catalog", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const categoryWhere = vi.fn().mockResolvedValue([{ id: firstCategoryId }]);
    const categoryFrom = vi.fn().mockReturnValue({ where: categoryWhere });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const lockFor = vi.fn().mockResolvedValue([{ onboardingCompletedAt: completedAt }]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({ from: userFrom })
        .mockReturnValueOnce({ from: categoryFrom }),
      delete: deleteFrom,
      insert,
      update: vi.fn(),
    };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(repository.replace("u1", [firstCategoryId])).resolves.toMatchObject({
      ok: true,
      state: { categoryIds: [firstCategoryId] },
    });
    expect(deleteFrom).toHaveBeenCalledWith(userCategoryInterest);
    expect(insertValues).toHaveBeenCalledWith([
      { userId: "u1", categoryId: firstCategoryId, sortOrder: 0 },
    ]);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("atomically replaces interests and records only the first completion", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const lockFor = vi.fn().mockResolvedValue([{ id: "u1" }]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const categoryWhere = vi
      .fn()
      .mockResolvedValue([{ id: firstCategoryId }, { id: secondCategoryId }]);
    const categoryFrom = vi.fn().mockReturnValue({ where: categoryWhere });
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: userFrom })
      .mockReturnValueOnce({ from: categoryFrom });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const returning = vi.fn().mockResolvedValue([{ onboardingCompletedAt: completedAt }]);
    const updateWhere = vi.fn().mockReturnValue({ returning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });
    const tx = { select, delete: deleteFrom, insert, update };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(
      repository.replaceAndComplete("u1", [firstCategoryId, secondCategoryId]),
    ).resolves.toEqual({
      ok: true,
      state: {
        categoryIds: [firstCategoryId, secondCategoryId],
        onboardingCompletedAt: completedAt,
      },
    });
    expect(deleteFrom).toHaveBeenCalledWith(userCategoryInterest);
    expect(insertValues).toHaveBeenCalledWith([
      { userId: "u1", categoryId: firstCategoryId, sortOrder: 0 },
      { userId: "u1", categoryId: secondCategoryId, sortOrder: 1 },
    ]);
    expect(lockFor).toHaveBeenCalledWith("key share");
  });

  it("rejects replace-and-complete before insert when the user is missing", async () => {
    const lockFor = vi.fn().mockResolvedValue([]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const tx = {
      select: vi.fn().mockReturnValue({ from: userFrom }),
      delete: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(repository.replaceAndComplete("missing", [firstCategoryId])).rejects.toThrow(
      "category interests user not found",
    );
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("throws from replace when the user is missing", async () => {
    const lockFor = vi.fn().mockResolvedValue([]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const tx = {
      select: vi.fn().mockReturnValue({ from: userFrom }),
      delete: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(repository.replace("missing", [firstCategoryId])).rejects.toThrow(
      "category interests user not found",
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("deduplicates category IDs before insert", async () => {
    const completedAt = new Date("2026-08-20T12:00:00.000Z");
    const categoryWhere = vi.fn().mockResolvedValue([{ id: firstCategoryId }]);
    const categoryFrom = vi.fn().mockReturnValue({ where: categoryWhere });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });
    const lockFor = vi.fn().mockResolvedValue([{ onboardingCompletedAt: completedAt }]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({ from: userFrom })
        .mockReturnValueOnce({ from: categoryFrom }),
      delete: deleteFrom,
      insert,
      update: vi.fn(),
    };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(
      repository.replace("u1", [firstCategoryId, firstCategoryId]),
    ).resolves.toMatchObject({
      ok: true,
      state: { categoryIds: [firstCategoryId] },
    });
    expect(insertValues).toHaveBeenCalledWith([
      { userId: "u1", categoryId: firstCategoryId, sortOrder: 0 },
    ]);
  });

  it("does not mutate interests when a category is unknown", async () => {
    const lockFor = vi.fn().mockResolvedValue([{ id: "u1" }]);
    const userWhere = vi.fn().mockReturnValue({ for: lockFor });
    const userFrom = vi.fn().mockReturnValue({ where: userWhere });
    const categoryWhere = vi.fn().mockResolvedValue([{ id: firstCategoryId }]);
    const categoryFrom = vi.fn().mockReturnValue({ where: categoryWhere });
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: userFrom })
      .mockReturnValueOnce({ from: categoryFrom });
    const tx = { select, delete: vi.fn(), insert: vi.fn(), update: vi.fn() };
    const transaction = vi.fn(async (work: (transaction: typeof tx) => unknown) => work(tx));
    const repository = new DrizzleCategoryInterestsRepository({ transaction } as never);

    await expect(
      repository.replaceAndComplete("u1", [firstCategoryId, secondCategoryId]),
    ).resolves.toEqual({ ok: false, invalidCategoryIds: [secondCategoryId] });
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
