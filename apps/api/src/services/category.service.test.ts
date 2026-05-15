import type { Category } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { CategoryError } from "../lib/errors.js";
import { CategoryService } from "./category.service.js";
import type { ICategoryRepository } from "./interfaces/category.js";

const rootId = "00000000-0000-4000-8000-000000000001";
const childId = "00000000-0000-4000-8000-000000000002";
const grandchildId = "00000000-0000-4000-8000-000000000003";
const missingId = "00000000-0000-4000-8000-000000000099";

function category(overrides: Partial<Category>): Category {
  return {
    id: rootId,
    name: "Root",
    slug: "root",
    description: null,
    archived: false,
    sortOrder: 0,
    parentId: null,
    heroImageKey: null,
    ...overrides,
  };
}

function createSut(categories: Category[]) {
  const findAll = vi.fn().mockResolvedValue(categories);
  const repo = { findAll } as unknown as ICategoryRepository;
  const service = new CategoryService(repo);
  return { service, findAll };
}

describe("CategoryService.list", () => {
  it("returns valid category hierarchy unchanged", async () => {
    const rows = [
      category({ id: rootId, name: "Root", slug: "root", parentId: null }),
      category({ id: childId, name: "Child", slug: "child", parentId: rootId }),
    ];
    const { service } = createSut(rows);

    await expect(service.list()).resolves.toEqual(rows);
  });

  it("normalizes unresolved parent references to null", async () => {
    const { service } = createSut([
      category({ id: childId, name: "Child", slug: "child", parentId: missingId }),
    ]);

    await expect(service.list()).resolves.toEqual([
      category({ id: childId, name: "Child", slug: "child", parentId: null }),
    ]);
  });

  it("normalizes circular parent references to null", async () => {
    const { service } = createSut([
      category({ id: childId, name: "Child", slug: "child", parentId: grandchildId }),
      category({
        id: grandchildId,
        name: "Grandchild",
        slug: "grandchild",
        parentId: childId,
      }),
    ]);

    await expect(service.list()).resolves.toEqual([
      category({ id: childId, name: "Child", slug: "child", parentId: null }),
      category({
        id: grandchildId,
        name: "Grandchild",
        slug: "grandchild",
        parentId: null,
      }),
    ]);
  });
});

describe("CategoryService.validateParent", () => {
  it("accepts null and valid parent ids", async () => {
    const { service } = createSut([
      category({ id: rootId, name: "Root", slug: "root", parentId: null }),
      category({ id: childId, name: "Child", slug: "child", parentId: rootId }),
    ]);

    await expect(service.validateParent(childId, null)).resolves.toBeUndefined();
    await expect(service.validateParent(childId, rootId)).resolves.toBeUndefined();
  });

  it("rejects missing parent ids", async () => {
    const { service } = createSut([
      category({ id: childId, name: "Child", slug: "child", parentId: null }),
    ]);

    await expect(service.validateParent(childId, missingId)).rejects.toBeInstanceOf(CategoryError);
  });

  it("rejects self-parenting", async () => {
    const { service } = createSut([
      category({ id: childId, name: "Child", slug: "child", parentId: null }),
    ]);

    await expect(service.validateParent(childId, childId)).rejects.toBeInstanceOf(CategoryError);
  });

  it("rejects circular ancestry", async () => {
    const { service } = createSut([
      category({ id: rootId, name: "Root", slug: "root", parentId: childId }),
      category({ id: childId, name: "Child", slug: "child", parentId: rootId }),
    ]);

    await expect(service.validateParent(grandchildId, childId)).rejects.toBeInstanceOf(
      CategoryError,
    );
  });
});
