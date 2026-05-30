"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { CategoryMobileEditSheet } from "@/components/admin/categories-board/category-mobile-edit-sheet";
import type { AdminCategory } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type CategoryNode = AdminCategory & { children: CategoryNode[] };
type FlatRow = AdminCategory & { depth: number };

function flattenCategories(categories: AdminCategory[]): FlatRow[] {
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
  const sortNodes = (items: CategoryNode[]) =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const out: FlatRow[] = [];
  const walk = (items: CategoryNode[], depth: number) => {
    for (const node of sortNodes(items)) {
      const { children, ...cat } = node;
      out.push({ ...cat, depth });
      if (children.length > 0) walk(children, depth + 1);
    }
  };
  walk(roots, 0);
  return out;
}

type Props = {
  categories: AdminCategory[];
  query?: string;
};

export function CategoriesMobileList({ categories, query = "" }: Props) {
  const q = query.trim().toLowerCase();
  const flat = flattenCategories(categories).filter((c) => {
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  if (flat.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/50 px-4 py-8 text-center font-body text-sm text-on-surface-variant lg:hidden">
        {q ? "No categories match your search." : "No categories on this page."}
      </p>
    );
  }

  return (
    <CatalogVirtualizedList className="lg:hidden" itemCount={flat.length}>
      {flat.map((c) => (
        <CatalogMobileCardShell
          key={c.id}
          id={c.id}
          title={c.name}
          selectionLabel={`Select ${c.name}`}
          status={
            c.archived ? (
              <AdminStatusBadge domain="category" status="archived" />
            ) : (
              <AdminStatusBadge domain="category" status="active" />
            )
          }
          footer={
            <div className="flex flex-col gap-2">
              <CategoryMobileEditSheet category={c} categories={categories} />
              <Button variant="secondary" size="sm" className="min-h-11 w-full" asChild>
                <Link href={`/admin/categories/${c.id}`}>Open</Link>
              </Button>
            </div>
          }
        >
          <div style={{ paddingInlineStart: `${Math.min(c.depth, 4) * 0.75}rem` }}>
            <Link href={`/admin/categories/${c.id}`} className="font-headline text-sm text-primary">
              {c.name}
            </Link>
            <p className="font-label text-[10px] uppercase text-on-surface-variant">/{c.slug}</p>
          </div>
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}
