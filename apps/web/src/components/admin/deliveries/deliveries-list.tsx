"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { useStaffQueue } from "@/components/admin/staff/use-staff-queue";
import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import {
  DELIVERIES_PATH,
  type DeliveriesFilterChip,
  type DeliveriesFilters,
  type DeliveriesSearch,
  deliveriesHref,
  deliveryBadges,
  deliveryLotTitle,
  deliveryPanelHref,
  deliveryPhoneMeta,
  deliveryPrice,
  deliverySaleLine,
  deliverySince,
  deliverySinceExact,
  deliveryTabs,
  lotFulfilmentHref,
  paddleLine,
} from "@/lib/admin/deliveries/deliveries.vm";
import type { DeliveriesPage, DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import {
  type DataColumn,
  DataViews,
  EmptyValue,
  FilterSheet,
  ListPage,
  type OverflowAction,
  PersonCell,
  PrimaryCell,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { DeliveryPanel } from "./delivery-panel";

export type DeliveriesListProps = {
  page: DeliveriesPage | null;
  search: DeliveriesSearch;
  filters: DeliveriesFilters;
  chips: DeliveriesFilterChip[];
  /** The lot in the URL when it is not on this page of the view. */
  selected: DeliveryView | null;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  filtered: boolean;
  /** Fulfilment and Administrators work deliveries; everyone else who can open the page reads. */
  canWork: boolean;
  /** The server's clock, so relative times read the same on server and browser. */
  now: string;
};

const lotIdOf = (row: DeliveryView) => row.lotId;

/**
 * Every won lot a buyer wants delivered, on the staff list template (D1–D6): one tab per delivery
 * status with its count, search and a sale filter, and a queue panel (PRD-7) that steps through
 * the rows with J and K. Pricing a quote arrives in the next change; until then the page reads,
 * and dispatch, tracking and delivered stay on Lot fulfilment.
 *
 * From 1024px the panel sits beside the list (D3, D4). While it is open the list keeps the Lot,
 * Status, Price and Waiting columns in view beside it; the buyer and destination are in the
 * panel. Coming back to the tab refreshes the list, so a request that changed meanwhile shows it.
 */
export function DeliveriesList(props: DeliveriesListProps) {
  const { page, search, filters, canWork } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  const now = useMemo(() => new Date(props.now), [props.now]);
  const rows = page?.items ?? [];
  const href = useCallback(
    (patch: Record<string, string | null>) => deliveriesHref(search, patch),
    [search],
  );
  const panelHref = useCallback((id: string | null) => deliveryPanelHref(search, id), [search]);

  // A work queue (PRD-7): the panel's address is `?record=`, J and K step in the order shown. A
  // lot in the address that has no delivery keeps its panel, which says so (D6).
  const queue = useStaffQueue({
    param: "record",
    rows,
    getId: lotIdOf,
    initialId: filters.record,
    hrefFor: panelHref,
    selected: props.selected,
    keepMissing: true,
    ...(page ? { total: page.total, offset: page.offset } : {}),
    noun: DELIVERIES_COPY.queueNoun,
  });
  const panelOpen = queue.openId !== null;

  const columns = useMemo<DataColumn<DeliveryView>[]>(
    () => [
      {
        id: "lot",
        header: DELIVERIES_COPY.columns.lot,
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={panelHref(row.lotId)}
            Link={Link}
            thumbnail={{ src: row.lot.imageUrl }}
            secondary={deliverySaleLine(row.sale, now)}
          >
            {deliveryLotTitle(row.lot)}
          </PrimaryCell>
        ),
      },
      {
        id: "buyer",
        header: DELIVERIES_COPY.columns.buyer,
        width: "17%",
        mobile: "hidden",
        cell: (row) => <PersonCell name={row.buyer.name} secondary={paddleLine(row.buyer)} />,
      },
      {
        id: "destination",
        header: DELIVERIES_COPY.columns.destination,
        width: "16%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.destination,
      },
      {
        id: "status",
        header: DELIVERIES_COPY.columns.status,
        width: "176px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <DeliveryBadges row={row} />,
      },
      {
        id: "price",
        header: DELIVERIES_COPY.columns.price,
        width: "104px",
        numeric: true,
        mobile: "hidden",
        cell: (row) => deliveryPrice(row) ?? <EmptyValue />,
      },
      {
        id: "summary",
        header: DELIVERIES_COPY.columns.summary,
        phoneOnly: true,
        mobile: "meta",
        cell: (row) => deliveryPhoneMeta(row),
      },
      {
        id: "waiting",
        header: DELIVERIES_COPY.columns.waiting,
        width: "160px",
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) =>
          row.statusSince === null ? (
            deliverySince(row, now)
          ) : (
            <time dateTime={row.statusSince} title={deliverySinceExact(row, now) ?? undefined}>
              {deliverySince(row, now)}
            </time>
          ),
      },
    ],
    [panelHref, now],
  );
  // Beside the open panel, which names the buyer and the destination, the list keeps the lot,
  // status, price and waiting columns in view (D3).
  const shownColumns = useMemo(
    () =>
      panelOpen
        ? columns.filter((column) => column.id !== "buyer" && column.id !== "destination")
        : columns,
    [columns, panelOpen],
  );

  const actionsFor = useCallback(
    (row: DeliveryView): OverflowAction[] => [
      { id: "open", label: DELIVERIES_COPY.rowActions.open, onSelect: () => queue.open(row.lotId) },
      ...(canWork
        ? [
            {
              id: "fulfilment",
              label: DELIVERIES_COPY.rowActions.fulfilment,
              href: lotFulfilmentHref(row.lotId),
            },
          ]
        : []),
      ...(row.lot.lotNumber !== null
        ? [
            {
              id: "copy",
              label: DELIVERIES_COPY.rowActions.copyLot,
              onSelect: () =>
                copyToClipboard(String(row.lot.lotNumber), DELIVERIES_COPY.rowActions.lotNumber),
            },
          ]
        : []),
    ],
    [canWork, queue.open],
  );

  const empty = DELIVERIES_COPY.empty[filters.view];
  const saleOptions = (page?.sales ?? []).map((sale) => ({ value: sale.id, label: sale.title }));

  return (
    <>
      <ListPage<DeliveryView>
        title={DELIVERIES_COPY.title}
        description={DELIVERIES_COPY.description}
        Link={ListLink}
        listKey="bid-admin.deliveries"
        access={canWork ? "full" : "read-only"}
        views={
          <DataViews
            views={deliveryTabs(search, page?.counts ?? null).map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: tab.href,
              ...(tab.count !== undefined ? { count: tab.count } : {}),
              // D2: the one view with work waiting, its count in ink and read as "3 waiting".
              ...(tab.id === "waiting" && tab.count
                ? { countTone: "attention" as const, countLabel: DELIVERIES_COPY.waitingCountLabel }
                : {}),
            }))}
            activeId={filters.view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={filters.q}
            fullWidth
            label={DELIVERIES_COPY.search.label}
            placeholder={DELIVERIES_COPY.search.placeholder}
            value={filters.q}
            onSearch={(q) => navigate(href({ q: q || null }))}
          />
        }
        filters={
          <FilterSheet
            title={DELIVERIES_COPY.filters.title}
            description={DELIVERIES_COPY.filters.description}
            sections={[
              {
                kind: "radio",
                id: "sale",
                label: DELIVERIES_COPY.filters.sale,
                value: filters.saleId,
                anyLabel: DELIVERIES_COPY.filters.anySale,
                options: saleOptions,
              },
              {
                kind: "radio",
                id: "sort",
                label: DELIVERIES_COPY.filters.order,
                value: filters.sort === "oldest" ? "oldest" : "",
                anyLabel: DELIVERIES_COPY.filters.newest,
                options: [{ value: "oldest", label: DELIVERIES_COPY.filters.oldest }],
              },
            ]}
            onApply={(values) =>
              navigate(
                href({
                  sale: (values.sale as string) || null,
                  sort: (values.sort as string) || null,
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
        onClearFilters={() => navigate(href({ q: null, sale: null }))}
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: DELIVERIES_COPY.error.title,
                description: props.loadError,
                onRetry: () => navigate(`${DELIVERIES_PATH}${window.location.search}`),
              }
            : null
        }
        empty={{
          title: empty.title,
          ...(empty.description ? { description: empty.description } : {}),
          illustration: "parcel",
        }}
        noResults={{ noun: DELIVERIES_COPY.noResultsNoun }}
        table={{
          columns: shownColumns,
          ...queue.table,
          label: DELIVERIES_COPY.listLabel,
          getRowId: lotIdOf,
          // The lot cell carries the sale on a second line, and a thumbnail.
          defaultDensity: "comfortable",
          rowActions: {
            label: (row) => DELIVERIES_COPY.rowActions.label(deliveryLotTitle(row.lot)),
            actions: actionsFor,
          },
        }}
        pageSize={{
          value: filters.limit as 25 | 50 | 100,
          onChange: (size) => navigate(href({ limit: String(size) })),
        }}
        pagination={props.pagination}
      />
      <DeliveryPanel
        row={queue.record}
        // Only once the list has loaded: a failed read is the list's error, not a missing lot.
        missing={page !== null && panelOpen && queue.record === null}
        onBack={queue.close}
        canWork={canWork}
        panelProps={{ ...queue.panelProps, open: page !== null && panelOpen }}
        now={now}
      />
    </>
  );
}

/** The status, and "Awaiting payment" beside an unpaid booking: at most two. */
export function DeliveryBadges({ row }: { row: DeliveryView }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {deliveryBadges(row).map((badge) => (
        <StatusBadge
          key={badge.label}
          tone={badge.tone}
          {...(badge.shape ? { shape: badge.shape } : {})}
        >
          {badge.label}
        </StatusBadge>
      ))}
    </span>
  );
}
