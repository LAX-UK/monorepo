export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  archived: boolean;
  sortOrder: number;
  parentId: string | null;
  heroImageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryNode = Category & {
  children: CategoryNode[];
};

export type CategoryUsage = {
  lots: number;
  sales: number;
  submissions: number;
  interests: number;
  total: number;
};

export function emptyCategoryUsage(): CategoryUsage {
  return { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 };
}

export function withCategoryUsageTotal(usage: Omit<CategoryUsage, "total">): CategoryUsage {
  return {
    ...usage,
    total: usage.lots + usage.sales + usage.submissions + usage.interests,
  };
}

export type AdminCategory = Category & {
  usage: CategoryUsage;
};

export type AdminCategoryListResult = {
  rows: AdminCategory[];
  total: number;
};

export type AdminCategoriesMostUsed = {
  id: string;
  name: string;
  slug: string;
  usage: Pick<CategoryUsage, "lots" | "sales" | "submissions" | "total">;
};

export type AdminCategoriesListSummary = {
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  usageTotals: Pick<CategoryUsage, "lots" | "sales" | "submissions">;
  mostUsedCategory: AdminCategoriesMostUsed | null;
};

export function primaryCategoryId(categoryIds: readonly string[]): string | null {
  return categoryIds[0] ?? null;
}
