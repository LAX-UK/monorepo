import "server-only";
import type { CategoryReader } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import type { Category, CategoryNode } from "@auction/types";

function parseCategory(raw: unknown): Category {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    name: String(o.name),
    slug: String(o.slug),
    description: o.description == null ? null : String(o.description),
    archived: Boolean(o.archived ?? false),
    sortOrder: Number(o.sortOrder ?? 0),
    parentId: o.parentId == null ? null : String(o.parentId),
    heroImageKey: o.heroImageKey == null || o.heroImageKey === "" ? null : String(o.heroImageKey),
  };
}

export async function getServerCategoryReader(): Promise<CategoryReader> {
  const client = await getServerHc();
  const list = async (): Promise<Category[]> => {
    const res = await client.categories.$get();
    if (!res.ok) {
      throw new Error(`Failed to list categories: ${res.status}`);
    }
    const body = (await res.json()) as { data: unknown[] };
    return body.data.map(parseCategory);
  };
  return {
    list,
    async tree(): Promise<CategoryNode[]> {
      const categories = await list();
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
      const sortNodes = (items: CategoryNode[]): CategoryNode[] =>
        items
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((node) => ({ ...node, children: sortNodes(node.children) }));
      return sortNodes(roots);
    },
  };
}
