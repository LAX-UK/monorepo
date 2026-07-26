"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { CategoryMobileEditSheet } from "@/components/admin/categories-board/category-mobile-edit-sheet";
import {
  filterCategoryTaxonomyRows,
  flattenCategoryTaxonomyRows,
} from "@/lib/admin/categories/category-taxonomy-rows";
import type { AdminCategory } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  categories: AdminCategory[];
  query?: string;
};

export function CategoriesMobileList({ categories, query = "" }: Props) {
  const flat = filterCategoryTaxonomyRows(flattenCategoryTaxonomyRows(categories), query);

  if (flat.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/50 px-4 py-8 text-center font-body text-sm text-on-surface-variant">
        {query.trim() ? "No categories match your search." : "No categories on this page."}
      </p>
    );
  }

  return (
    <CatalogVirtualizedList itemCount={flat.length}>
      {flat.map((c) => (
        <CatalogMobileCardShell
          key={c.id}
          id={c.id}
          title={c.name}
          selectionLabel={`Select ${c.name}`}
          trailing={
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
            <Link
              href={`/admin/categories/${c.id}`}
              className="font-headline text-sm font-semibold text-primary hover:underline"
            >
              {c.name}
            </Link>
            <p className="mt-1 text-[10px] text-on-surface-variant">
              {c.usage.lots} lots · {c.usage.sales} sales · {c.usage.submissions} submissions
            </p>
          </div>
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}
