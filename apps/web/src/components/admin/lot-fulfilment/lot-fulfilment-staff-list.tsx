"use client";

import { useLotFulfilmentActions } from "@/components/admin/lot-fulfilment/use-lot-fulfilment-actions";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  FULFILMENT_VIEWS,
  type LotFulfilmentListSearch,
  type LotFulfilmentStaffRow,
  lotFulfilmentListHref,
  lotFulfilmentPanelHref,
  lotFulfilmentSort,
} from "@/lib/admin/lot-fulfilment-staff-list.vm";
import {
  CellLink,
  type DataColumn,
  DataViews,
  DetailPanel,
  ListPage,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type LotFulfilmentStaffListProps = {
  rows: LotFulfilmentStaffRow[];
  search: LotFulfilmentListSearch;
  /** Rows per view, keyed by view id ("all" and each step). */
  counts: Record<string, number>;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
};

const str = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

const STEP_HINT: Record<string, string> = {
  awaiting_payment: "Waiting for the buyer to pay. Release opens once payment is captured.",
  awaiting_release: "Paid. Release the lot so it can be shipped or collected.",
  released: "Released. Ship it, or mark it ready for the buyer to collect.",
  in_transit: "On its way. Mark it delivered once the carrier confirms.",
  ready_for_collection: "Waiting for the buyer. Record who collected it.",
  delivered: "Done. The lot has reached the buyer.",
  cancelled: "This fulfilment was cancelled. There is nothing more to do.",
};

/**
 * The fulfilment queue for sold lots on the staff list template: a view per step with counts,
 * search by lot, most recently changed first (sortable on the server), and a record panel
 * deep-linked with `?lot=`. Each row's `…` menu holds the lot's next step; steps that need
 * details open a short form.
 */
export function LotFulfilmentStaffList(props: LotFulfilmentStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback(
    (id: string | null) => lotFulfilmentPanelHref(search, id),
    [search],
  );
  const panel = useListPanel({
    param: "lot",
    initialId: str(search.lot) || null,
    hrefFor: panelHref,
  });
  const fulfilment = useLotFulfilmentActions();
  const status = str(search.status);
  const q = str(search.q);

  const columns = useMemo<DataColumn<LotFulfilmentStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={panel.PanelLink} secondary={row.context}>
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Step",
        width: "184px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "method",
        header: "Method",
        width: "120px",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => row.method ?? null,
      },
      {
        id: "shipping",
        header: "Carrier and tracking",
        width: "22%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.shipping ?? null,
      },
      {
        id: "updated",
        header: "Last change",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} withTime />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const views = [{ id: "all", label: "All" }, ...FULFILMENT_VIEWS].map((view) => ({
    id: view.id,
    label: view.label,
    href: lotFulfilmentListHref(search, { status: view.id === "all" ? null : view.id }),
    count: props.counts[view.id] ?? 0,
  }));
  const open = rows.find((row) => row.id === panel.openId) ?? null;
  const activeView = FULFILMENT_VIEWS.find((view) => view.id === status);

  return (
    <>
      <ListPage<LotFulfilmentStaffRow>
        title="Lot fulfilment"
        description="Sold lots from payment to the buyer: release, then ship or hand over for collection."
        Link={ListLink}
        listKey="bid-admin.lot-fulfilment"
        views={<DataViews views={views} activeId={status || "all"} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search lot fulfilment"
            placeholder="Search by lot title"
            value={q}
            onSearch={(next) => navigate(lotFulfilmentListHref(search, { q: next || null }))}
          />
        }
        activeFilters={props.filterChips
          .filter((chip) => chip.id !== "status")
          .map((chip) => ({
            id: chip.id,
            label: chip.label,
            onRemove: () => navigate(chip.clearHref),
          }))}
        onClearFilters={() => navigate(lotFulfilmentListHref(search, { q: null }))}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                title: "Lot fulfilment did not load",
                description: props.loadError,
                onRetry: () => navigate(lotFulfilmentListHref(search, {})),
              }
            : null
        }
        empty={
          activeView
            ? {
                title: `Nothing ${activeView.label.toLowerCase()}`,
                description: STEP_HINT[activeView.id] ?? "",
              }
            : {
                title: "No sold lots to fulfil yet",
                description:
                  "When a lot sells, it appears here and moves through payment, release and delivery.",
              }
        }
        noResults={{
          title: "No lots match",
          description: "Try another lot title, or clear the search.",
        }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["shipping"],
          defaultSort: lotFulfilmentSort.defaultSort,
          sort: lotFulfilmentSort.state(str(search.sort)),
          onSortChange: (sort) =>
            navigate(lotFulfilmentListHref(search, { sort: lotFulfilmentSort.param(sort) })),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.title}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              ...fulfilment.actionsFor(row),
              { id: "lot", label: "Open lot page", href: row.lotHref },
              ...(row.saleHref ? [{ id: "sale", label: "Open sale", href: row.saleHref }] : []),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(lotFulfilmentListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <LotFulfilmentQuickView
        row={open}
        actions={open ? fulfilment.actionsFor(open) : []}
        next={open ? fulfilment.nextStep(open) : null}
        onClose={() => panel.show(null)}
      />
      {fulfilment.dialogs}
    </>
  );
}

/** A lot's fulfilment beside the queue: where it stands, its next step, and links out. */
export function LotFulfilmentQuickView({
  row,
  actions,
  next,
  onClose,
}: {
  row: LotFulfilmentStaffRow | null;
  actions: OverflowAction[];
  next: { label: string; run: () => void } | null;
  onClose: () => void;
}) {
  const others = next ? actions.filter((action) => action.label !== next.label) : actions;
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Lot fulfilment"}
      description={row?.context ?? undefined}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.lotHref}>Open lot</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        row && others.length > 0 ? (
          <OverflowMenu label={`More fulfilment actions for ${row.title}`} actions={others} />
        ) : null
      }
      notice={
        row ? (
          <Notice tone="info" title={row.status.label}>
            {STEP_HINT[row.step]}
          </Notice>
        ) : null
      }
      summary={
        row
          ? [
              { label: "Method", value: row.method ?? "Not chosen yet" },
              { label: "Carrier and tracking", value: row.shipping ?? "Not shipped" },
              {
                label: "Last change",
                value: formatStaffDateTime(row.updatedAt, { zoneLabel: true }),
              },
              {
                label: "Sale",
                value: row.saleHref ? (
                  <CellLink href={row.saleHref} Link={Link}>
                    {row.saleTitle ?? "Open sale"}
                  </CellLink>
                ) : (
                  "Not in a sale"
                ),
              },
              { label: "Lot ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && next ? (
          <StaffButton variant="primary" onClick={next.run}>
            {next.label}
          </StaffButton>
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
