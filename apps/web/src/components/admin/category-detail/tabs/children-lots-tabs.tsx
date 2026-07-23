import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { DetailBoardShell, DetailEntityTable } from "@/components/admin/catalog/detail-board";
import {
  categoryByIdMap,
  categoryDepthOf,
  categoryDescendantsOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { categoryEditHref } from "@/components/admin/category-detail/category-detail-types";
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
      <DetailBoardShell
        title="Descendants"
        description="All descendant categories in the taxonomy tree."
      >
        <p className="text-sm text-on-surface-variant">No descendant categories.</p>
      </DetailBoardShell>
    );
  }

  return (
    <DetailBoardShell
      title="Descendants"
      description="All descendant categories in the taxonomy tree."
      count={children.length}
    >
      <DetailEntityTable
        rows={children}
        getRowId={(category) => category.id}
        emptyTitle="No descendant categories"
        columns={[
          {
            id: "name",
            header: "Category",
            cell: (category) => {
              const rel = categoryDepthOf(category.id, map) - rootDepth;
              return (
                <div
                  style={{
                    marginLeft: rel > 1 ? `${Math.min((rel - 1) * 1.25, 4)}rem` : undefined,
                  }}
                >
                  <Link
                    href={`/admin/categories/${category.id}`}
                    className="font-headline text-base text-on-surface hover:text-link"
                  >
                    {category.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-on-surface-variant">
                    /{category.slug}
                  </p>
                </div>
              );
            },
          },
          {
            id: "usage",
            header: "Usage",
            cell: (category) => (
              <span className="text-xs text-on-surface-variant">
                {category.usage.lots} lots · {category.usage.sales} sales ·{" "}
                {category.usage.submissions} submissions
              </span>
            ),
          },
          {
            id: "actions",
            header: "",
            headerClassName: "sr-only",
            className: "text-right",
            cell: (category) => (
              <Button variant="ghost" size="sm" asChild>
                <Link href={categoryEditHref(category.id)}>Edit</Link>
              </Button>
            ),
          },
        ]}
      />
    </DetailBoardShell>
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
      <DetailBoardShell title="Lots" description="Catalog lots tagged with this category.">
        <p className="text-sm text-on-surface-variant">No lots tagged with this category.</p>
      </DetailBoardShell>
    );
  }

  return (
    <DetailBoardShell
      title="Lots"
      description="Catalog lots tagged with this category."
      count={lots.length}
    >
      {showingCap ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Showing {lots.length} of {totalCount} lots.
        </p>
      ) : null}
      <DetailEntityTable
        rows={lots}
        getRowId={(lot) => lot.id}
        emptyTitle="No lots tagged with this category"
        columns={[
          {
            id: "title",
            header: "Lot",
            cell: (lot) => (
              <Link
                href={`/admin/lots/${lot.id}`}
                className="font-medium text-on-surface hover:text-link"
              >
                {lot.title}
              </Link>
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (lot) => <AdminStatusBadge domain="lot" status={lot.status} />,
          },
          {
            id: "actions",
            header: "",
            headerClassName: "sr-only",
            className: "text-right",
            cell: (lot) => (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/lots/${lot.id}`}>Open</Link>
              </Button>
            ),
          },
        ]}
      />
    </DetailBoardShell>
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
      <DetailBoardShell title="Sales" description="Sales linked to this category.">
        <p className="text-sm text-on-surface-variant">No sales linked to this category.</p>
      </DetailBoardShell>
    );
  }

  return (
    <DetailBoardShell
      title="Sales"
      description="Sales linked to this category."
      count={sales.length}
    >
      {showingCap ? (
        <p className="mb-4 text-sm text-on-surface-variant">
          Showing {sales.length} of {totalCount} sales.
        </p>
      ) : null}
      <DetailEntityTable
        rows={sales}
        getRowId={({ sale }) => sale.id}
        emptyTitle="No sales linked to this category"
        columns={[
          {
            id: "title",
            header: "Sale",
            cell: ({ sale }) => (
              <Link
                href={`/admin/sales/${sale.id}`}
                className="font-medium text-on-surface hover:text-link"
              >
                {sale.title}
              </Link>
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: ({ sale, lots }) => (
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge domain="sale" status={sale.status} />
                <span className="text-xs text-on-surface-variant">
                  {lots.length} {lots.length === 1 ? "lot" : "lots"}
                </span>
              </div>
            ),
          },
          {
            id: "actions",
            header: "",
            headerClassName: "sr-only",
            className: "text-right",
            cell: ({ sale }) => (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/sales/${sale.id}`}>Open</Link>
              </Button>
            ),
          },
        ]}
      />
    </DetailBoardShell>
  );
}
