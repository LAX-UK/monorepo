import type { CategoryNode } from "@auction/types";

/** Find a category id in a tree by slug (depth-first). */
export function findCategoryIdBySlug(
  categories: readonly CategoryNode[],
  slug: string,
): string | null {
  const stack = [...categories];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.slug === slug) return node.id;
    stack.push(...node.children);
  }
  return null;
}
