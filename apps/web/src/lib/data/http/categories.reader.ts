import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type { CategoryReader } from "@/lib/data/contracts";
import { categoryRowSchema } from "@/lib/data/http/categories.schema";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { getServerHc } from "@/lib/data/http/hc-server";
import type { CategoryNode } from "@auction/types";

export async function getServerCategoryReader(): Promise<CategoryReader> {
  const client = await getServerHc();
  const list = async () => {
    const res = await client.categories.$get();
    await throwIfNotOk(res, "categories");
    const body = await readJsonBody(res);
    const { rows } = readListEnvelope(body, categoryRowSchema, "GET /categories");
    return rows;
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
