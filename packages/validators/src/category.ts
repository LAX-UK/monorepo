import type { Category } from "@auction/types";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value ? value : undefined));

export const categoryIdParamSchema = z.object({
  categoryId: z.string().uuid(),
});

export const adminCreateCategoryBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optionalText,
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  heroImageKey: z.string().max(500).nullable().optional(),
});

/** Admin category form (create + edit) — `archived` is only sent on update. */
export const adminCategoryFormSchema = adminCreateCategoryBodySchema.extend({
  archived: z.boolean().optional(),
});

export const adminUpdateCategoryBodySchema = adminCreateCategoryBodySchema.partial().extend({
  archived: z.boolean().optional(),
});

export const adminCategoryListQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
});

export type CategoryHierarchyIssueCode = "parent_not_found" | "self_parent" | "cycle";

export type CategoryHierarchyIssue = {
  code: CategoryHierarchyIssueCode;
  message: string;
};

type CategoryNode = Pick<Category, "id" | "parentId">;

export function validateCategoryParent(
  categories: CategoryNode[],
  categoryId: string,
  parentId: string | null | undefined,
): CategoryHierarchyIssue | null {
  if (!parentId) return null;

  if (parentId === categoryId) {
    return {
      code: "self_parent",
      message: "Category cannot be its own parent",
    };
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  if (!byId.has(parentId)) {
    return {
      code: "parent_not_found",
      message: "Parent category does not exist",
    };
  }

  const visited = new Set<string>();
  let currentParentId: string | null | undefined = parentId;

  while (currentParentId) {
    if (currentParentId === categoryId) {
      return {
        code: "cycle",
        message: "Category hierarchy cannot contain cycles",
      };
    }

    if (visited.has(currentParentId)) {
      return {
        code: "cycle",
        message: "Category hierarchy cannot contain cycles",
      };
    }

    visited.add(currentParentId);
    currentParentId = byId.get(currentParentId)?.parentId;
  }

  return null;
}

export function normalizeCategoryHierarchy(categories: Category[]): Category[] {
  return categories.map((category) => {
    if (!category.parentId) return category;

    const issue = validateCategoryParent(categories, category.id, category.parentId);
    if (!issue) return category;

    return { ...category, parentId: null };
  });
}
