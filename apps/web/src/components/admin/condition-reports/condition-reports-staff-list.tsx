"use client";

import { ConditionReportQuickView } from "@/components/admin/condition-reports/condition-report-quick-view";
import {
  type ConditionReportActionTarget,
  useConditionReportActions,
} from "@/components/admin/condition-reports/use-condition-report-actions";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  CONDITION_REPORTS_DEFAULT_SORT,
  type ConditionReportStaffRow,
  type ConditionReportsListSearch,
  conditionReportPanelHref,
  conditionReportsListHref,
} from "@/lib/admin/condition-reports/condition-reports-staff-list.vm";
import {
  type AttentionStripItem,
  CellLink,
  type DataColumn,
  DataViews,
  ListPage,
  type Metric,
  PrimaryCell,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export type ConditionReportsStaffListProps = {
  rows: ConditionReportStaffRow[];
  search: ConditionReportsListSearch;
  views: StaffDataView[];
  activeLens: string;
  attention: AttentionStripItem[];
  metrics: Metric[] | null;
  empty: { title: string; description: string };
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  listError: string | null;
};

export function conditionReportActionTarget(
  row: ConditionReportStaffRow,
): ConditionReportActionTarget {
  return { id: row.id, lotTitle: row.lotTitle, status: row.statusCode };
}

/**
 * Buyer condition report requests on the staff list template: status views with counts, a
 * record panel deep-linked with `?request=` that holds the fulfil form, and a `…` menu on every
 * row for marking a request in progress or declining it, each confirmed first. The API does not
 * search or filter beyond the status, so there is no search or filter sheet; the sort orders the
 * rows on the page.
 */
export function ConditionReportsStaffList(props: ConditionReportsStaffListProps) {
  const { rows, search } = props;
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback(
    (id: string | null) => conditionReportPanelHref(search, id),
    [search],
  );
  const panel = useListPanel({
    param: "request",
    initialId: typeof search.request === "string" ? search.request : null,
    hrefFor: panelHref,
  });
  const { show } = panel;
  const closePanel = useCallback(() => show(null), [show]);
  const closeAndRefresh = useCallback(() => {
    show(null);
    router.refresh();
  }, [show, router]);
  const actions = useConditionReportActions({ openPanel: show, afterDecline: closeAndRefresh });

  const columns = useMemo<DataColumn<ConditionReportStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.lotTitle.toLowerCase(),
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={panel.PanelLink}>
            {row.lotTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "requester",
        header: "Requester",
        hideBelow: "md",
        mobile: "hidden",
        truncate: "middle",
        cell: (row) =>
          row.requester ? (
            <CellLink href={row.requesterHref} Link={ListLink}>
              {row.requester}
            </CellLink>
          ) : null,
      },
      {
        id: "status",
        header: "Status",
        width: "132px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>,
      },
      {
        id: "requested",
        header: "Requested",
        width: "176px",
        sortable: true,
        sortValue: (row) => Date.parse(row.requestedAt),
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.requestedAt} withTime />,
      },
    ],
    [panelHref, panel.PanelLink, ListLink],
  );

  const openRow = rows.find((row) => row.id === panel.openId) ?? null;
  const lens = props.activeLens;

  return (
    <>
      <ListPage<ConditionReportStaffRow>
        title="Condition report requests"
        description="Buyer requests for a condition report. Fulfilling one publishes it on the lot page."
        Link={ListLink}
        listKey="bid-admin.condition-reports"
        roleLabel="Catalogue"
        attention={props.attention}
        {...(props.metrics
          ? { metrics: { label: "Request summary", period: "All time", items: props.metrics } }
          : {})}
        views={<DataViews views={props.views} activeId={lens} Link={ListLink} />}
        loading={pending}
        filtered={false}
        error={
          props.listError
            ? {
                description: props.listError,
                onRetry: () => navigate(conditionReportsListHref(search, {})),
              }
            : null
        }
        empty={props.empty}
        table={{
          label: "Condition report requests",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "compact",
          defaultSort: CONDITION_REPORTS_DEFAULT_SORT,
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for the request for ${row.lotTitle}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "lot", label: "Open lot", href: row.lotHref },
              ...(row.requester
                ? [{ id: "requester", label: "Open requester", href: row.requesterHref }]
                : []),
              ...actions.actionsFor(conditionReportActionTarget(row)),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(conditionReportsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <ConditionReportQuickView
        row={openRow}
        onClose={closePanel}
        onFulfilled={closeAndRefresh}
        actions={openRow ? actions.actionsFor(conditionReportActionTarget(openRow)) : []}
      />
      {actions.dialogs}
    </>
  );
}
