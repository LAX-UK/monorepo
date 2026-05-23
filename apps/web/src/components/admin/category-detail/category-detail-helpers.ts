import type { AdminCategory } from "@auction/types";

export function categoryByIdMap(categories: AdminCategory[]): Map<string, AdminCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

export function categoryDepthOf(categoryId: string, map: Map<string, AdminCategory>): number {
  let d = 0;
  let cur = map.get(categoryId);
  const seen = new Set<string>();
  while (cur?.parentId && map.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    d += 1;
    cur = map.get(cur.parentId);
  }
  return d;
}

export function categoryDirectChildrenOf(rootId: string, all: AdminCategory[]): AdminCategory[] {
  return all
    .filter((c) => c.parentId === rootId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function categoryAncestorsOf(categoryId: string, all: AdminCategory[]): AdminCategory[] {
  const map = categoryByIdMap(all);
  const out: AdminCategory[] = [];
  let cur = map.get(categoryId);
  const seen = new Set<string>();
  while (cur?.parentId && map.has(cur.parentId) && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    const parent = map.get(cur.parentId);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

export function categoryDescendantsOf(rootId: string, all: AdminCategory[]): AdminCategory[] {
  const byParent = new Map<string | null, AdminCategory[]>();
  for (const c of all) {
    const p = c.parentId;
    if (!byParent.has(p)) byParent.set(p, []);
    const bucket = byParent.get(p);
    if (bucket) bucket.push(c);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
  const out: AdminCategory[] = [];
  const walk = (pid: string) => {
    for (const c of byParent.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(rootId);
  return out;
}
