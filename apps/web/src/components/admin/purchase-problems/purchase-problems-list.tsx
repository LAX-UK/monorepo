"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type PurchaseProblemsFilterChip,
  type PurchaseProblemsFilters,
  type PurchaseProblemsSearch,
  purchaseProblemHref,
  purchaseProblemsHref,
} from "@/lib/admin/purchase-problems/purchase-problems-search";
import {
  PURCHASE_PROBLEMS_PATH,
  PURCHASE_PROBLEM_CATEGORY_LABELS,
  PURCHASE_PROBLEM_EMPTY_COPY,
  PURCHASE_PROBLEM_ORDER_NOTE,
  lotLabel,
  purchaseProblemTabs,
  purchaseProblemsSummary,
} from "@/lib/admin/purchase-problems/purchase-problems.vm";
import type {
  PurchaseProblemAssignee,
  PurchaseProblemListItem,
  PurchaseProblemListPage,
} from "@/lib/data/http/admin-purchase-problems.schema";
import { formatLondonWhen } from "@/lib/datetime/london-time";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  type OverflowAction,
  PrimaryCell,
  StackedCell,
  StaffButton,
  TableSearch,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { OwnerCell, PurchaseProblemStatusBadge } from "./purchase-problem-cells";

export type PurchaseProblemsListProps = {
  page: PurchaseProblemListPage | null;
  search: PurchaseProblemsSearch;
  filters: PurchaseProblemsFilters;
  chips: PurchaseProblemsFilterChip[];
  assignees: PurchaseProblemAssignee[];
  pagination: { prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
  /** The server's clock, so dates read the same on server and browser. */
  now: string;
};

/**
 * Problems buyers reported with a paid purchase, on the staff list template. It opens on Open,
 * longest waiting first, and each tab shows how many reports it holds for the current search and
 * filters. Search takes a reference, a buyer or a lot. There are no bulk actions: each report
 * is its own conversation with a buyer.
 */
export function PurchaseProblemsList(props: PurchaseProblemsListProps) {
  const { page, search, filters } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const now = useMemo(() => new Date(props.now), [props.now]);
  const rows = page?.items ?? [];

  const nameOf = useCallback(
    (userId: string) => props.assignees.find((person) => person.id === userId)?.name,
    [props.assignees],
  );
  const href = useCallback(
    (patch: Record<string, string | null>) => purchaseProblemsHref(search, patch),
    [search],
  );

  const columns = useMemo<DataColumn<PurchaseProblemListItem>[]>(
    () => [
      {
        id: "reference",
        header: "Reference",
        width: "128px",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <PrimaryCell href={purchaseProblemHref(row.id)} Link={Link}>
            <span className="tabular-nums">{row.reference}</span>
          </PrimaryCell>
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "20%",
        mobile: "meta",
        cell: (row) => row.buyerName,
      },
      {
        id: "lot",
        header: "Lot",
        width: "26%",
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) => {
          const lot = lotLabel(row.lot);
          const place = [lot.secondary, row.lot.saleTitle].filter(Boolean).join(" · ");
          return <StackedCell {...(place ? { secondary: place } : {})}>{lot.primary}</StackedCell>;
        },
      },
      {
        id: "reason",
        header: "Reason",
        width: "150px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => PURCHASE_PROBLEM_CATEGORY_LABELS[row.category],
      },
      {
        id: "raised",
        header: "Raised",
        width: "172px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (
          <span className="tabular-nums">{formatLondonWhen(new Date(row.raisedAt), now)}</span>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        width: "170px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => <OwnerCell userId={row.assignedToUserId} nameOf={nameOf} />,
      },
      {
        id: "status",
        header: "Status",
        width: "132px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <PurchaseProblemStatusBadge status={row.status} />,
      },
    ],
    [nameOf, now],
  );

  const actionsFor = useCallback(
    (row: PurchaseProblemListItem): OverflowAction[] => [
      { id: "open", label: "Open", href: purchaseProblemHref(row.id) },
      {
        id: "copy",
        label: "Copy reference",
        onSelect: () => copyToClipboard(row.reference, "Reference"),
      },
    ],
    [],
  );

  const tabs = purchaseProblemTabs(page?.counts ?? null);
  const empty = PURCHASE_PROBLEM_EMPTY_COPY[filters.status];
  const saleOptions = (page?.sales ?? []).map((sale) => ({ value: sale.id, label: sale.title }));
  const ownerOptions = [
    { value: "unassigned", label: "Unassigned" },
    ...props.assignees.map((person) => ({ value: person.id, label: person.name })),
  ];
  const summary = page
    ? purchaseProblemsSummary({
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        itemCount: page.items.length,
      })
    : null;

  return (
    <ListPage<PurchaseProblemListItem>
      title="Purchase problems"
      description="Problems buyers report with a paid purchase. Take one on, put it right, and tell the buyer what was done."
      Link={ListLink}
      listKey="bid-admin.purchase-problems"
      access="full"
      views={
        <DataViews
          views={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            href: href({ status: tab.id }),
            count: tab.count,
          }))}
          activeId={filters.status}
          Link={ListLink}
        />
      }
      search={
        <TableSearch
          key={filters.q}
          fullWidth
          label="Search purchase problems"
          placeholder="Reference, buyer or lot"
          value={filters.q}
          onSearch={(q) => navigate(href({ q: q || null }))}
        />
      }
      filters={
        <FilterSheet
          title="Filter purchase problems"
          sections={[
            {
              kind: "radio",
              id: "sale",
              label: "Sale",
              value: filters.saleId,
              anyLabel: "Any sale",
              options: saleOptions,
            },
            {
              kind: "radio",
              id: "assignee",
              label: "Owner",
              value: filters.assignee,
              anyLabel: "Anyone",
              options: ownerOptions,
            },
          ]}
          onApply={(values) =>
            navigate(
              href({
                sale: (values.sale as string) || null,
                assignee: (values.assignee as string) || null,
              }),
            )
          }
        />
      }
      activeFilters={props.chips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        onRemove: () => navigate(chip.clearHref),
      }))}
      onClearFilters={() => navigate(href({ q: null, sale: null, assignee: null }))}
      loading={pending}
      filtered={props.filtered}
      error={
        props.loadError
          ? {
              title: "Purchase problems couldn't be loaded",
              description: props.loadError,
              onRetry: () => navigate(`${PURCHASE_PROBLEMS_PATH}${window.location.search}`),
            }
          : null
      }
      empty={{
        title: empty.title,
        description: empty.description,
        ...(filters.status === "open"
          ? {
              action: (
                <StaffButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(href({ status: "in_progress" }))}
                >
                  View in progress
                </StaffButton>
              ),
            }
          : {}),
      }}
      noResults={{ noun: "reports" }}
      table={{
        columns,
        data: rows,
        getRowId: (row) => row.id,
        defaultDensity: "comfortable",
        onRowOpen: (row) => navigate(purchaseProblemHref(row.id)),
        rowActions: {
          label: (row) => `Actions for ${row.reference}, ${row.buyerName}`,
          actions: actionsFor,
        },
      }}
      pagination={
        props.pagination && summary
          ? { ...props.pagination, summary: `${summary} · ${PURCHASE_PROBLEM_ORDER_NOTE}` }
          : null
      }
    />
  );
}
