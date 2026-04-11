import "server-only";
import type { CategoryReader } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import type { Category } from "@auction/types";

function parseCategory(raw: unknown): Category {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    name: String(o.name),
    slug: String(o.slug),
    parentId: o.parentId == null ? null : String(o.parentId),
  };
}

export async function getServerCategoryReader(): Promise<CategoryReader> {
  const client = await getServerHc();
  return {
    async list(): Promise<Category[]> {
      const res = await client.categories.$get();
      if (!res.ok) {
        throw new Error(`Failed to list categories: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown[] };
      return body.data.map(parseCategory);
    },
  };
}
