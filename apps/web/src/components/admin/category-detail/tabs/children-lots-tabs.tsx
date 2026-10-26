"use client";

import {
  categoryByIdMap,
  categoryDepthOf,
  categoryDescendantsOf,
} from "@/components/admin/category-detail/category-detail-helpers";
import { categoryEditHref } from "@/components/admin/category-detail/category-detail-types";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import {
  type DataColumn,
  PrimaryCell,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { AdminCategory, Lot } from "@auction/types";
import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type ChildrenProps = {
  categoryId: string;
  allCategories: AdminCategory[];
};

type ChildRow = {
  category: AdminCategory;
  /** Position in the branch, depth first, so the default order is the tree's own. */
  order: number;
  /** Where it sits under this category: "Prints › Etchings". */
  path: string | null;
};

const CHILD_COLUMNS: DataColumn<ChildRow>[] = [
  {
    id: "name",
    header: "Category",
    sortable: true,
    sortValue: (row) => row.order,
    mobile: "title",
    cell: (row) => (
      <PrimaryCell
        href={`/admin/categories/${row.category.id}`}
        Link={NextLink}
        secondary={row.path ? `Under ${row.path}` : undefined}
      >
        {row.category.name}
      </PrimaryCell>
    ),
  },
  {
    id: "lots",
    header: "Lots",
    numeric: true,
    width: "96px",
    sortable: true,
    sortValue: (row) => row.category.usage.lots,
    hideBelow: "md",
    cell: (row) => row.category.usage.lots,
  },
  {
    id: "sales",
    header: "Sales",
    numeric: true,
    width: "96px",
    sortable: true,
    sortValue: (row) => row.category.usage.sales,
    hideBelow: "md",
    cell: (row) => row.category.usage.sales,
  },
  {
    id: "submissions",
    header: "Submissions",
    numeric: true,
    width: "128px",
    sortable: true,
    sortValue: (row) => row.category.usage.submissions,
    hideBelow: "lg",
    cell: (row) => row.category.usage.submissions,
  },
  {
    id: "status",
    header: "Status",
    width: "120px",
    mobile: "badge",
    cell: (row) => {
      const status = staffStatus("category", row.category.archived ? "archived" : "active");
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
  rowActionsColumn<ChildRow>({
    label: (row) => `Actions for ${row.category.name}`,
    Link: NextLink,
    actions: (row) => [
      { id: "edit", label: "Edit category", icon: Pencil, href: categoryEditHref(row.category.id) },
    ],
  }),
];

export function CategoryChildrenTab({ categoryId, allCategories }: ChildrenProps) {
  const rows = useMemo<ChildRow[]>(() => {
    const map = categoryByIdMap(allCategories);
    const rootDepth = categoryDepthOf(categoryId, map);
    return categoryDescendantsOf(categoryId, allCategories).map((category, order) => {
      const depth = categoryDepthOf(category.id, map) - rootDepth;
      const names: string[] = [];
      let parent = category.parentId ? map.get(category.parentId) : undefined;
      for (let step = 1; step < depth && parent; step++) {
        names.unshift(parent.name);
        parent = parent.parentId ? map.get(parent.parentId) : undefined;
      }
      return { category, order, path: names.length > 0 ? names.join(" › ") : null };
    });
  }, [allCategories, categoryId]);
  const direct = allCategories.filter((c) => c.parentId === categoryId).length;

  return (
    <RelatedRecordsSection<ChildRow>
      title="Subcategories"
      description={
        direct > 0
          ? `${direct} direct, ${rows.length} in all in this branch.`
          : "Categories nested under this one."
      }
      label="Subcategories"
      action={
        <StaffButton asChild size="sm" variant="secondary">
          <Link href="/admin/categories/new">New category</Link>
        </StaffButton>
      }
      columns={CHILD_COLUMNS}
      data={rows}
      getRowId={(row) => row.category.id}
      defaultSort={{ columnId: "name", direction: "asc" }}
      empty={{
        title: "No subcategories yet",
        description:
          "Create a category and choose this one as its parent, or edit an existing category to move it here.",
      }}
    />
  );
}

type LotsProps = {
  categoryId: string;
  lots: Lot[];
  totalCount?: number;
};

const LOT_COLUMNS: DataColumn<Lot>[] = [
  {
    id: "title",
    header: "Lot",
    sortable: true,
    sortValue: (lot) => lot.title.toLowerCase(),
    mobile: "title",
    cell: (lot) => (
      <PrimaryCell href={`/admin/lots/${lot.id}`} Link={NextLink}>
        {lot.title}
      </PrimaryCell>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "140px",
    mobile: "badge",
    cell: (lot) => {
      const status = staffStatus("lot", lot.status, { lot: { winnerId: lot.winnerId } });
      return (
        <StatusBadge tone={status.tone} live={status.live ?? false}>
          {status.label}
        </StatusBadge>
      );
    },
  },
  rowActionsColumn<Lot>({
    label: (lot) => `Actions for ${lot.title}`,
    Link: NextLink,
    actions: (lot) => [
      { id: "open", label: "Open lot", icon: ExternalLink, href: `/admin/lots/${lot.id}` },
    ],
  }),
];

export function CategoryLotsTab({ categoryId, lots, totalCount }: LotsProps) {
  const total = totalCount ?? lots.length;
  const listHref = `/admin/lots?categoryId=${categoryId}`;
  return (
    <RelatedRecordsSection<Lot>
      title="Lots"
      description="Lots tagged with this category."
      label="Lots in this category"
      action={
        lots.length > 0 ? (
          <StaffButton asChild size="sm" variant="ghost">
            <Link href={listHref}>View all lots</Link>
          </StaffButton>
        ) : null
      }
      columns={LOT_COLUMNS}
      data={lots}
      getRowId={(lot) => lot.id}
      defaultSort={{ columnId: "title", direction: "asc" }}
      empty={{
        title: "No lots tagged with this category",
        description: "Lots appear here once they are given this category on the lot's edit page.",
      }}
      {...(total > lots.length ? { footer: `Showing ${lots.length} of ${total} lots.` } : {})}
    />
  );
}

type SalesProps = {
  sales: AdminSaleListRow[];
  totalCount?: number;
};

const SALE_COLUMNS: DataColumn<AdminSaleListRow>[] = [
  {
    id: "title",
    header: "Sale",
    sortable: true,
    sortValue: ({ sale }) => sale.title.toLowerCase(),
    mobile: "title",
    cell: ({ sale, lots }) => (
      <PrimaryCell
        href={`/admin/sales/${sale.id}`}
        Link={NextLink}
        secondary={`${lots.length} ${lots.length === 1 ? "lot" : "lots"}`}
      >
        {sale.title}
      </PrimaryCell>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "140px",
    mobile: "badge",
    cell: ({ sale }) => {
      const status = staffStatus("sale", sale.status);
      return (
        <StatusBadge tone={status.tone} live={status.live ?? false}>
          {status.label}
        </StatusBadge>
      );
    },
  },
  rowActionsColumn<AdminSaleListRow>({
    label: ({ sale }) => `Actions for ${sale.title}`,
    Link: NextLink,
    actions: ({ sale }) => [
      { id: "open", label: "Open sale", icon: ExternalLink, href: `/admin/sales/${sale.id}` },
    ],
  }),
];

export function CategorySalesTab({ sales, totalCount }: SalesProps) {
  const total = totalCount ?? sales.length;
  return (
    <RelatedRecordsSection<AdminSaleListRow>
      title="Sales"
      description="Sales with lots in this category."
      label="Sales in this category"
      columns={SALE_COLUMNS}
      data={sales}
      getRowId={({ sale }) => sale.id}
      defaultSort={{ columnId: "title", direction: "asc" }}
      empty={{
        title: "No sales linked to this category",
        description: "Sales appear here once lots in them use this category.",
      }}
      {...(total > sales.length ? { footer: `Showing ${sales.length} of ${total} sales.` } : {})}
    />
  );
}
