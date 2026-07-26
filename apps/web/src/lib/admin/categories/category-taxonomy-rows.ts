import type { AdminCategory } from "@auction/types";

export type CategoryTaxonomyRow = AdminCategory & { depth: number };

type CategoryNode = AdminCategory & { children: CategoryNode[] };

function sortNodes(items: CategoryNode[]): CategoryNode[] {
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((node) => ({ ...node, children: sortNodes(node.children) }));
}

/** Build a stable parent/child tree from a flat page of categories. */
export function buildCategoryTree(categories: AdminCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return sortNodes(roots);
}

/** Depth-first flattening for table and mobile list rendering. */
export function flattenCategoryTaxonomyRows(categories: AdminCategory[]): CategoryTaxonomyRow[] {
  const out: CategoryTaxonomyRow[] = [];
  const walk = (items: CategoryNode[], depth: number) => {
    for (const node of items) {
      const { children, ...cat } = node;
      out.push({ ...cat, depth });
      if (children.length > 0) walk(children, depth + 1);
    }
  };
  walk(buildCategoryTree(categories), 0);
  return out;
}

/** Optional client-side filter for mobile cards (server search remains authoritative). */
export function filterCategoryTaxonomyRows(
  rows: CategoryTaxonomyRow[],
  query: string,
): CategoryTaxonomyRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
}
