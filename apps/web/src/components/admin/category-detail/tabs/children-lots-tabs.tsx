import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { DetailBoardShell, DetailEntityTable } from "@/components/admin/catalog/detail-board";
import {
  categoryByIdMap,
  categoryDepthOf,
  categoryDescendantsOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { categoryEditHref } from "@/components/admin/category-detail/category-detail-types";
import type { AdminCategory, Lot } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type ChildrenProps = {
  categoryId: string;
  allCategories: AdminCategory[];
};

export function CategoryChildrenTab({ categoryId, allCategories }: ChildrenProps) {
  const map = categoryByIdMap(allCategories);
  const children = categoryDescendantsOf(categoryId, allCategories);
  const rootDepth = categoryDepthOf(categoryId, map);
  const directChildCount = allCategories.filter((c) => c.parentId === categoryId).length;

  return (
    <DetailBoardShell
      title="Subcategories"
      description={
        directChildCount > 0
          ? `${directChildCount} direct · ${children.length} nested total in this branch.`
          : "All nested categories under this branch."
      }
      count={children.length}
    >
      <DetailEntityTable
        rows={children}
        getRowId={(category) => category.id}
        emptyTitle="No subcategories yet"
        emptyDescription="Create a child category from the list page or edit this category to assign a parent elsewhere."
        footer={
          children.length > 0 ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/categories?new=1">New category</Link>
            </Button>
          ) : undefined
        }
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
            id: "status",
            header: "Status",
            cell: (category) => (
              <AdminStatusBadge
                domain="category"
                status={category.archived ? "archived" : "active"}
              />
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
  categoryId: string;
  lots: Lot[];
  totalCount?: number;
};

export function CategoryLotsTab({ categoryId, lots, totalCount }: LotsProps) {
  const showingCap = totalCount != null && totalCount > lots.length;

  return (
    <DetailBoardShell
      title="Lots"
      description="Catalog lots tagged with this category."
      count={totalCount ?? lots.length}
    >
      <DetailEntityTable
        rows={lots}
        getRowId={(lot) => lot.id}
        emptyTitle="No lots tagged with this category"
        emptyDescription="Lots appear here once they are assigned this category on the lot edit form."
        footer={
          showingCap ? (
            <span>
              Showing {lots.length} of {totalCount} lots.{" "}
              <Link
                href={`/admin/lots?categoryId=${categoryId}`}
                className="font-medium text-link hover:underline"
              >
                View all lots →
              </Link>
            </span>
          ) : lots.length > 0 ? (
            <Link
              href={`/admin/lots?categoryId=${categoryId}`}
              className="font-medium text-link hover:underline"
            >
              Open filtered lots list →
            </Link>
          ) : undefined
        }
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

  return (
    <DetailBoardShell
      title="Sales"
      description="Sales linked to this category."
      count={totalCount ?? sales.length}
    >
      <DetailEntityTable
        rows={sales}
        getRowId={({ sale }) => sale.id}
        emptyTitle="No sales linked to this category"
        emptyDescription="Sales appear here once lots in those sales use this category."
        footer={
          showingCap ? (
            <span>
              Showing {sales.length} of {totalCount} sales on this tab.
            </span>
          ) : undefined
        }
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
