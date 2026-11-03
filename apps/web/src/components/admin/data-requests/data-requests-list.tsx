"use client";

import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { rowActions } from "@/lib/admin/data-requests/data-request-actions";
import {
  DATA_REQUESTS_PATH,
  type DataRequestsFilterChip,
  type DataRequestsFilters,
  type DataRequestsSearch,
  dataRequestHref,
  dataRequestsHref,
} from "@/lib/admin/data-requests/data-requests-search";
import {
  DATA_REQUESTS_EMPTY,
  KIND_FILTER_LABELS,
  PRODUCT_LABELS,
  STATUS_FILTER_LABELS,
  dataRequestsAttention,
  dataRequestsMetrics,
  dataRequestsViewTabs,
  formatDay,
  kindParts,
  personLabelParts,
  requestStatus,
} from "@/lib/admin/data-requests/data-requests.vm";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import type {
  DataRequestList,
  DataRequestSummary,
  DataRequestView,
} from "@auction/identity-contracts/data-requests";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  type OverflowAction,
  PrimaryCell,
  SortMenu,
  StackedCell,
  StaffButton,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DueColumn, ProductChips, ProductsDone } from "./data-request-cells";
import { LogDataRequestDialog } from "./log-data-request-dialog";

export type DataRequestsListProps = {
  list: DataRequestList | null;
  summary: DataRequestSummary | null;
  search: DataRequestsSearch;
  filters: DataRequestsFilters;
  chips: DataRequestsFilterChip[];
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  /** A search or filter narrows the list (the view tab alone does not). */
  filtered: boolean;
  /** The London day, for the Log dialog. */
  today: string;
};

const SORT_OPTIONS = [
  { value: "due", label: "Due date" },
  { value: "requested", label: "Requested" },
] as const;

const KIND_OPTIONS = Object.entries(KIND_FILTER_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const STATUS_OPTIONS = Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const PRODUCT_OPTIONS = Object.entries(PRODUCT_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Every request for a copy of someone's data on the staff list template: automatic downloads and
 * requests staff logged, on one clock. It opens on Open, soonest due first, with the missed and
 * close deadlines above the table. Emails are masked here; search takes a reference or a full
 * email address. There are no bulk actions, because each request is its own legal case; the row
 * menu opens the record, copies the reference and leads to Extend, Close or Continue manually.
 */
export function DataRequestsList(props: DataRequestsListProps) {
  const { list, summary, search, filters } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [logging, setLogging] = useState(false);
  const rows = list?.items ?? [];

  const recordHref = useCallback(
    (reference: string, action?: "extend" | "close" | "continue") => {
      const href = dataRequestHref(reference, filters);
      return action ? `${href}${href.includes("?") ? "&" : "?"}action=${action}` : href;
    },
    [filters],
  );

  const actionsFor = useCallback(
    (row: DataRequestView): OverflowAction[] => {
      const available = rowActions(row);
      const entry = (
        id: string,
        label: string,
        state: ReturnType<typeof rowActions>["extend"],
        action: "extend" | "close" | "continue",
      ): OverflowAction[] =>
        state.kind === "hidden"
          ? []
          : state.kind === "disabled"
            ? // A blocked action is a plain item, so the menu can say why next to it.
              [{ id, label, disabledReason: state.reason }]
            : [{ id, label, href: recordHref(row.reference, action) }];
      return [
        { id: "open", label: "Open", href: recordHref(row.reference) },
        {
          id: "copy",
          label: "Copy reference",
          onSelect: () => copyToClipboard(row.reference, "Reference"),
        },
        ...entry("continue", "Continue manually…", available.continueManually, "continue"),
        ...entry("extend", "Extend…", available.extend, "extend"),
        ...entry("close", "Close with outcome…", available.close, "close"),
      ];
    },
    [recordHref],
  );

  const columns = useMemo<DataColumn<DataRequestView>[]>(
    () => [
      {
        id: "person",
        header: "Person",
        width: "22%",
        mobile: "title",
        cell: (row) => {
          const person = personLabelParts(row);
          return (
            <PrimaryCell
              href={recordHref(row.reference)}
              Link={Link}
              secondary={<span className="tabular-nums">{person.secondary}</span>}
            >
              {person.primary}
            </PrimaryCell>
          );
        },
      },
      {
        id: "kind",
        header: "Kind",
        width: "16%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) => {
          const kind = kindParts(row);
          return <StackedCell secondary={kind.secondary}>{kind.primary}</StackedCell>;
        },
      },
      {
        id: "products",
        header: "Products",
        width: "172px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <ProductChips products={row.products} />,
      },
      {
        id: "requested",
        header: "Requested",
        width: "104px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <span className="tabular-nums">{formatDay(row.requestedOn)}</span>,
      },
      {
        id: "due",
        header: "Due",
        width: "156px",
        mobile: "meta",
        truncate: false,
        cell: (row) => <DueColumn request={row} />,
      },
      {
        id: "status",
        header: "Status",
        width: "156px",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const status = requestStatus(row);
          return (
            <StatusBadge tone={status.tone} {...(status.shape ? { shape: status.shape } : {})}>
              {status.label}
            </StatusBadge>
          );
        },
      },
      {
        id: "done",
        header: "Products done",
        width: "112px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <ProductsDone request={row} />,
      },
    ],
    [recordHref],
  );

  const attention = dataRequestsAttention(summary, {
    overdue: dataRequestsHref(search, { view: "overdue" }),
    dueSoon: dataRequestsHref(search, { view: "open", sort: "due" }),
  });
  const tabs = dataRequestsViewTabs(summary);
  const empty = DATA_REQUESTS_EMPTY[filters.view];

  return (
    <>
      <ListPage<DataRequestView>
        title="Data requests"
        description="Requests for a copy of a person's data, from the download and logged by staff. Each must be answered by its due date."
        Link={ListLink}
        listKey="bid-admin.data-requests"
        access="full"
        primaryAction={
          <StaffButton
            variant="primary"
            icon={<Plus aria-hidden />}
            onClick={() => setLogging(true)}
          >
            Log a manual request
          </StaffButton>
        }
        attention={attention}
        {...(summary
          ? {
              metrics: {
                label: "Data request summary",
                period: "Open now · answered on time over 12 months",
                items: dataRequestsMetrics(summary),
              },
            }
          : {})}
        views={
          <DataViews
            views={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: dataRequestsHref(search, { view: tab.id }),
              ...(tab.count !== undefined ? { count: tab.count } : {}),
            }))}
            activeId={filters.view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={filters.q}
            fullWidth
            label="Search data requests"
            placeholder="Reference or full email address"
            value={filters.q}
            onSearch={(q) => navigate(dataRequestsHref(search, { q: q || null }))}
          />
        }
        filters={
          <>
            <FilterSheet
              title="Filter data requests"
              sections={[
                {
                  kind: "radio",
                  id: "status",
                  label: "Status",
                  value: filters.status ?? "",
                  anyLabel: "Any status",
                  options: STATUS_OPTIONS,
                },
                {
                  kind: "radio",
                  id: "kind",
                  label: "Kind",
                  value: filters.kind,
                  anyLabel: "Any kind",
                  options: KIND_OPTIONS,
                },
                {
                  kind: "radio",
                  id: "product",
                  label: "Product",
                  value: filters.product,
                  anyLabel: "Any product",
                  options: PRODUCT_OPTIONS,
                },
              ]}
              onApply={(values) =>
                navigate(
                  dataRequestsHref(search, {
                    status: (values.status as string) || null,
                    kind: (values.kind as string) || null,
                    product: (values.product as string) || null,
                  }),
                )
              }
            />
            <SortMenu
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(next) => navigate(dataRequestsHref(search, { sort: next }))}
            />
          </>
        }
        activeFilters={props.chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          onRemove: () => navigate(chip.clearHref),
        }))}
        onClearFilters={() =>
          navigate(dataRequestsHref(search, { q: null, status: null, kind: null, product: null }))
        }
        loading={pending}
        filtered={props.filtered}
        error={
          props.loadError
            ? {
                title: "Data requests couldn't be loaded",
                description: props.loadError,
                onRetry: () => navigate(`${DATA_REQUESTS_PATH}${window.location.search}`),
              }
            : null
        }
        empty={{
          title: empty.title,
          description: empty.description,
          // An empty list offers the action that creates a record, so the header's one is not repeated.
          action: (
            <>
              {filters.view === "open" ? (
                <StaffButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(dataRequestsHref(search, { view: "closed" }))}
                >
                  View closed
                </StaffButton>
              ) : null}
              <StaffButton
                size="sm"
                variant={filters.view === "open" ? "ghost" : "secondary"}
                icon={<Plus aria-hidden />}
                onClick={() => setLogging(true)}
              >
                Log a manual request
              </StaffButton>
            </>
          ),
        }}
        noResults={{ noun: "requests" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.reference,
          defaultDensity: "comfortable",
          onRowOpen: (row) => navigate(recordHref(row.reference)),
          rowActions: {
            label: (row) => `Actions for ${row.reference}, ${row.personLabel}`,
            actions: actionsFor,
          },
        }}
        pagination={props.pagination}
      />
      <LogDataRequestDialog open={logging} onOpenChange={setLogging} today={props.today} />
    </>
  );
}
