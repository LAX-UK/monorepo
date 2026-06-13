import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import {
  categoryByIdMap,
  categoryDepthOf,
  categoryDescendantsOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { categoryEditHref } from "@/components/admin/category-detail/category-detail-types";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminCategory, Lot } from "@auction/types";
import { Button } from "@auction/ui";
import Link from "next/link";

type ChildrenProps = {
  categoryId: string;
  allCategories: AdminCategory[];
};

export function CategoryChildrenTab({ categoryId, allCategories }: ChildrenProps) {
  const map = categoryByIdMap(allCategories);
  const children = categoryDescendantsOf(categoryId, allCategories);
  const rootDepth = categoryDepthOf(categoryId, map);

  if (children.length === 0) {
    return (
      <CatalogDetailTabPanel
        title="Descendants"
        description="All descendant categories in the taxonomy tree."
      >
        <p className="text-sm text-on-surface-variant">No descendant categories.</p>
      </CatalogDetailTabPanel>
    );
  }

  return (
    <CatalogDetailTabPanel
      title="Descendants"
      description="All descendant categories in the taxonomy tree."
    >
      <ul className="space-y-2">
        {children.map((c) => {
          const rel = categoryDepthOf(c.id, map) - rootDepth;
          return (
            <li key={c.id}>
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-3"
                style={{
                  marginLeft: rel > 1 ? `${Math.min((rel - 1) * 1.25, 4)}rem` : undefined,
                }}
              >
                <div>
                  <Link
                    href={`/admin/categories/${c.id}`}
                    className="font-headline text-base text-on-surface hover:text-link"
                  >
                    {c.name}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-on-surface-variant">/{c.slug}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {c.usage.lots} lots · {c.usage.sales} sales · {c.usage.submissions} submissions
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={categoryEditHref(c.id)}>Edit</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </CatalogDetailTabPanel>
  );
}

type LotsProps = {
  lots: Lot[];
  totalCount?: number;
};

export function CategoryLotsTab({ lots, totalCount }: LotsProps) {
  const showingCap = totalCount != null && totalCount > lots.length;

  if (lots.length === 0) {
    return (
      <CatalogDetailTabPanel title="Lots" description="Catalog lots tagged with this category.">
        <p className="text-sm text-on-surface-variant">No lots tagged with this category.</p>
      </CatalogDetailTabPanel>
    );
  }

  return (
    <CatalogDetailTabPanel title="Lots" description="Catalog lots tagged with this category.">
      {showingCap ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Showing {lots.length} of {totalCount} lots.
        </p>
      ) : null}
      <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
        {lots.map((lot) => (
          <li key={lot.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link
                href={`/admin/lots/${lot.id}`}
                className="font-medium text-on-surface hover:text-link"
              >
                {lot.title}
              </Link>
              <p className="text-xs text-on-surface-variant">
                {lotStatusLabel[lot.status] ?? lot.status}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/lots/${lot.id}`}>Open</Link>
            </Button>
          </li>
        ))}
      </ul>
    </CatalogDetailTabPanel>
  );
}

type SalesProps = {
  sales: import("@/lib/data/http/admin.server").AdminSaleListRow[];
  totalCount?: number;
};

export function CategorySalesTab({ sales, totalCount }: SalesProps) {
  const showingCap = totalCount != null && totalCount > sales.length;

  if (sales.length === 0) {
    return (
      <CatalogDetailTabPanel title="Sales" description="Sales linked to this category.">
        <p className="text-sm text-on-surface-variant">No sales linked to this category.</p>
      </CatalogDetailTabPanel>
    );
  }

  return (
    <CatalogDetailTabPanel title="Sales" description="Sales linked to this category.">
      {showingCap ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Showing {sales.length} of {totalCount} sales.
        </p>
      ) : null}
      <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
        {sales.map(({ sale, lots }) => (
          <li key={sale.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link
                href={`/admin/sales/${sale.id}`}
                className="font-medium text-on-surface hover:text-link"
              >
                {sale.title}
              </Link>
              <p className="text-xs capitalize text-on-surface-variant">
                {sale.status.replaceAll("_", " ")} · {lots.length} lots
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/sales/${sale.id}`}>Open</Link>
            </Button>
          </li>
        ))}
      </ul>
    </CatalogDetailTabPanel>
  );
}
