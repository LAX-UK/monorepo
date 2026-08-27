import { describe, expect, it, vi } from "vitest";
import { DrizzleCategoryRepository } from "./drizzle-category.repository.js";

const categoryId = "11111111-1111-4111-8111-111111111111";

function countQuery(rows: { categoryId: string; value: number }[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe("DrizzleCategoryRepository.usageForMany", () => {
  it("returns an empty map for an empty id list without querying", async () => {
    const select = vi.fn();
    const repository = new DrizzleCategoryRepository({ select } as never);
    await expect(repository.usageForMany([])).resolves.toEqual(new Map());
    expect(select).not.toHaveBeenCalled();
  });

  it("counts buyer interests in usage totals", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce(countQuery([]))
      .mockReturnValueOnce(countQuery([]))
      .mockReturnValueOnce(countQuery([]))
      .mockReturnValueOnce(countQuery([{ categoryId, value: 3 }]));
    const repository = new DrizzleCategoryRepository({ select } as never);

    const usage = await repository.usageFor(categoryId);
    expect(usage).toEqual({
      lots: 0,
      sales: 0,
      submissions: 0,
      interests: 3,
      total: 3,
    });
    expect(select).toHaveBeenCalledTimes(4);
  });
});
