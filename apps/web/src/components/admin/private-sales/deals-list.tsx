"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type DealsFilters,
  type DealsSearch,
  dealsHref,
} from "@/lib/admin/private-sales/private-sales-search";
import {
  DEALS_PATH,
  DEAL_EMPTY_COPY,
  DEAL_ORDER_NOTE,
  DEAL_VIEW_LABELS,
  dealHref,
  dealNextStep,
} from "@/lib/admin/private-sales/private-sales.vm";
import { settlementRowLabel } from "@/lib/admin/private-sales/settlement-follow-up.vm";
import type { DealListItem, DealListPage } from "@/lib/data/http/admin-private-sales.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { DEAL_VIEWS } from "@auction/domain";
import {
  type DataColumn,
  DataViews,
  EmptyValue,
  ListPage,
  type OverflowAction,
  PrimaryCell,
  StackedCell,
  StaffMoney,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { DeadlineCell, DealStageBadge } from "./deal-cells";

/** What the stage column says under the badge: what the deal waits for, or what went wrong at settlement. */
function stageNote(row: DealListItem): string {
  return row.settlementFollowUp
    ? settlementRowLabel(row.settlementFollowUp)
    : dealNextStep(row.stage, row.buyerName !== null);
}

export type DealsListProps = {
  page: DealListPage | null;
  search: DealsSearch;
  filters: DealsFilters;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Every private sale on the staff list template, by the view that says what it waits for. The
 * stage column shows its next step, so the list answers "what do I do with this?" before the deal
 * is opened. There are no totals: a count on each view says where the work is.
 */
export function DealsList({ page, search, filters, pagination, loadError }: DealsListProps) {
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const rows = page?.items ?? [];
  const href = useCallback(
    (patch: Record<string, string | null>) => dealsHref(search, patch),
    [search],
  );

  const columns = useMemo<DataColumn<DealListItem>[]>(
    () => [
      {
        id: "work",
        header: "Work",
        width: "28%",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={dealHref(row.reference)}
            Link={Link}
            secondary={
              <span className="tabular-nums">
                {row.reference} · {row.workReference}
              </span>
            }
          >
            {row.workTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "seller",
        header: "Seller",
        width: "16%",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => row.sellerName,
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "16%",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => row.buyerName ?? <EmptyValue />,
      },
      {
        id: "price",
        header: "Price",
        width: "120px",
        numeric: true,
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => <StaffMoney minor={row.priceMinor} />,
      },
      {
        id: "stage",
        header: "Stage",
        width: "20%",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StackedCell secondary={stageNote(row)}>
            <DealStageBadge stage={row.stage} />
          </StackedCell>
        ),
      },
      {
        id: "deadline",
        header: "Next date",
        width: "190px",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        cell: (row) => <DeadlineCell deal={row} />,
      },
    ],
    [],
  );

  const actionsFor = useCallback(
    (row: DealListItem): OverflowAction[] => [
      { id: "open", label: "Open", href: dealHref(row.reference) },
      {
        id: "copy",
        label: "Copy reference",
        onSelect: () => copyToClipboard(row.reference, "Reference"),
      },
    ],
    [],
  );

  const empty = DEAL_EMPTY_COPY[filters.view];

  return (
    <ListPage<DealListItem>
      title="Private sales"
      description="Works sold by private treaty, from offer to the seller's payout."
      Link={ListLink}
      listKey="bid-admin.private-sales"
      access="full"
      views={
        <DataViews
          views={DEAL_VIEWS.map((id) => ({
            id,
            label: DEAL_VIEW_LABELS[id],
            href: href({ view: id }),
            ...(page ? { count: page.counts[id] } : {}),
          }))}
          activeId={filters.view}
          Link={ListLink}
        />
      }
      loading={pending}
      filtered={false}
      error={
        loadError
          ? {
              title: "Private sales couldn't be loaded",
              description: loadError,
              onRetry: () => navigate(`${DEALS_PATH}${window.location.search}`),
            }
          : null
      }
      empty={{
        title: empty.title,
        description: empty.description,
      }}
      noResults={{ noun: "deals" }}
      table={{
        columns,
        data: rows,
        getRowId: (row) => row.reference,
        defaultDensity: "comfortable",
        onRowOpen: (row) => navigate(dealHref(row.reference)),
        rowActions: {
          label: (row) => `Actions for ${row.reference}, ${row.workTitle}`,
          actions: actionsFor,
        },
      }}
      pagination={
        pagination
          ? { ...pagination, summary: `${pagination.summary} · ${DEAL_ORDER_NOTE[filters.view]}` }
          : null
      }
    />
  );
}
