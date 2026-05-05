export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export type CategoryNode = Category & {
  children: CategoryNode[];
};

export function primaryCategoryId(categoryIds: readonly string[]): string | null {
  return categoryIds[0] ?? null;
}
