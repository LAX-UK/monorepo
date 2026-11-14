"use client";

import { useLegalEntityActions } from "@/components/admin/legal-entities/legal-entity-actions";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  LEGAL_ENTITIES_DEFAULT_SORT,
  LEGAL_ENTITY_KIND_FILTERS,
  LEGAL_ENTITY_STATUS_FILTERS,
  type LegalEntitiesListSearch,
  type LegalEntitiesStaffRow,
  type LegalEntitiesViewId,
  legalEntitiesAttention,
  legalEntitiesFilterChips,
  legalEntitiesListHref,
  legalEntitiesMetrics,
  legalEntitiesSortHref,
  legalEntitiesViews,
  legalEntityRecordHref,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import type { AdminLegalEntityListSummary } from "@/lib/data/http/admin-legal-entities.shared";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PrimaryCell,
  type SortState,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type LegalEntitiesStaffListProps = {
  search: LegalEntitiesListSearch;
  view: LegalEntitiesViewId;
  /** The sort in the URL; the server has already put the rows in this order. */
  sort: SortState;
  rows: LegalEntitiesStaffRow[];
  summary: AdminLegalEntityListSummary;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's legal entities on the staff list template: the Stripe requirements view, search, status
 * and kind filters, sort in the URL and the directory's summary. A row opens the entity's page,
 * which keeps this list's query for Previous and Next; Back returns to the list as it was.
 * Impersonation sits in each row's `…` menu, behind a confirm dialog.
 */
export function LegalEntitiesStaffList(props: LegalEntitiesStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const actions = useLegalEntityActions();
  const q = typeof search.q === "string" ? search.q : "";
  const status = typeof search.status === "string" ? search.status : "";
  const kind = typeof search.kind === "string" ? search.kind : "";
  const filtered = Boolean(q || status || kind || props.view !== "all");
  const recordHref = useCallback(
    (row: LegalEntitiesStaffRow) => legalEntityRecordHref(search, row.id),
    [search],
  );

  const columns = useMemo<DataColumn<LegalEntitiesStaffRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        mobile: "title",
        sortable: true,
        cell: (row) => (
          <PrimaryCell href={recordHref(row)} Link={Link}>
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "176px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge
            tone={row.statusPresentation.tone}
            live={row.statusPresentation.live ?? false}
          >
            {row.statusPresentation.label}
          </StatusBadge>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        width: "22%",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => row.kind,
      },
      {
        id: "stripe",
        header: "Stripe requirements",
        width: "184px",
        hideBelow: "lg",
        mobile: "hidden",
        sortable: true,
        defaultSortDirection: "desc",
        cell: (row) => row.stripe,
      },
      {
        id: "updated",
        header: "Updated",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
    ],
    [recordHref],
  );

  const activeFilters = legalEntitiesFilterChips(search).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  // Clearing filters keeps the view: the tab is where the Stripe requirements view is chosen.
  const clearHref = legalEntitiesListHref(search, { q: null, status: null, kind: null });

  return (
    <>
      <ListPage<LegalEntitiesStaffRow>
        title="Legal entities"
        description="Organisations and individuals that sell on the platform. Check their status and Stripe readiness, or work as one."
        Link={ListLink}
        listKey="bid-admin.legal-entities"
        attention={legalEntitiesAttention(search, props.summary, props.view)}
        metrics={{
          label: "Legal entities summary",
          period: "All legal entities, whatever the view",
          items: legalEntitiesMetrics(props.summary),
        }}
        views={
          <DataViews
            views={legalEntitiesViews(search, props.summary)}
            activeId={props.view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search legal entities"
            placeholder="Search by name"
            value={q}
            onSearch={(next) => navigate(legalEntitiesListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter legal entities"
            description="The Stripe requirements view is set by the tabs above the list."
            sections={[
              {
                kind: "radio",
                id: "status",
                label: "Status",
                anyLabel: "Any status",
                options: LEGAL_ENTITY_STATUS_FILTERS,
                value: status,
              },
              {
                kind: "radio",
                id: "kind",
                label: "Kind",
                anyLabel: "Any kind",
                options: LEGAL_ENTITY_KIND_FILTERS,
                value: kind,
              },
            ]}
            onApply={(values) =>
              navigate(
                legalEntitiesListHref(search, {
                  status: (values.status as string) || null,
                  kind: (values.kind as string) || null,
                }),
              )
            }
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(clearHref)}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(legalEntitiesListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No legal entities yet",
          description:
            "Legal entities appear here when someone starts selling or registers an organisation.",
        }}
        noResults={{ noun: "legal entities" }}
        table={{
          label: "Legal entities",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultSort: LEGAL_ENTITIES_DEFAULT_SORT,
          sort: props.sort,
          onSortChange: (sort) => navigate(legalEntitiesSortHref(search, sort)),
          rowHref: recordHref,
          rowActions: {
            label: (row) => `Actions for legal entity ${row.name}`,
            actions: (row) => [
              { id: "record", label: "Open legal entity page", href: recordHref(row) },
              ...(row.stripeDueCount > 0
                ? [
                    {
                      id: "stripe",
                      label: "Review Stripe requirements",
                      href: legalEntityRecordHref(search, row.id, "stripe"),
                    },
                  ]
                : []),
              ...actions.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(legalEntitiesListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      {actions.dialogs}
    </>
  );
}
