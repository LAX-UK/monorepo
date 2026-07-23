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
  total: number;
};

export type AdminCategory = Category & {
  usage: CategoryUsage;
};

export type AdminCategoryListResult = {
  rows: AdminCategory[];
  total: number;
};

export type AdminCategoriesListSummary = {
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  usageTotals: Pick<CategoryUsage, "lots" | "sales" | "submissions">;
};

export function primaryCategoryId(categoryIds: readonly string[]): string | null {
  return categoryIds[0] ?? null;
}
