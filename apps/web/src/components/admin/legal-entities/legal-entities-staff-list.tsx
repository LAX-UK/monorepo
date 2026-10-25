"use client";

import { useLegalEntityActions } from "@/components/admin/legal-entities/legal-entity-actions";
import { LegalEntityQuickView } from "@/components/admin/legal-entities/legal-entity-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  LEGAL_ENTITY_KIND_FILTERS,
  LEGAL_ENTITY_STATUS_FILTERS,
  type LegalEntitiesListSearch,
  type LegalEntitiesStaffRow,
  type LegalEntitiesViewId,
  type LegalEntityPreview,
  legalEntitiesAttention,
  legalEntitiesFilterChips,
  legalEntitiesListHref,
  legalEntitiesMetrics,
  legalEntitiesViews,
  legalEntityPanelHref,
  legalEntityRecordHref,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import type { AdminLegalEntityListSummary } from "@/lib/data/http/admin-legal-entities.shared";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PrimaryCell,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type LegalEntitiesStaffListProps = {
  search: LegalEntitiesListSearch;
  view: LegalEntitiesViewId;
  rows: LegalEntitiesStaffRow[];
  summary: AdminLegalEntityListSummary;
  preview: LegalEntityPreview | null;
  selectedEntityId: string | null;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's legal entities on the staff list template: the Stripe requirements view, search, status
 * and kind filters, the directory's summary, and a record panel with the entity's readiness.
 * Impersonation sits in each row's `…` menu and the panel, behind a confirm dialog. The panel
 * opens with `?entity=`, and the full record page is one click away.
 */
export function LegalEntitiesStaffList(props: LegalEntitiesStaffListProps) {
  const { search, rows } = props;
  const router = useRouter();
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(props.selectedEntityId);
  const actions = useLegalEntityActions();
  const q = typeof search.q === "string" ? search.q : "";
  const status = typeof search.status === "string" ? search.status : "";
  const kind = typeof search.kind === "string" ? search.kind : "";
  const filtered = Boolean(q || status || kind || props.view !== "all");

  // Opening asks the server for the entity's details; closing is local, and the URL follows.
  const openPanel = (id: string) => {
    setOpenId(id);
    router.push(legalEntityPanelHref(search, id), { scroll: false });
  };
  const closePanel = () => {
    setOpenId(null);
    window.history.replaceState(null, "", legalEntityPanelHref(search, null));
  };

  const PanelLink = useMemo<StaffLinkComponent>(
    () =>
      function PanelLink({ href, onClick, children, prefetch: _prefetch, ...rest }) {
        return (
          <a
            href={href}
            {...rest}
            onClick={(event) => {
              onClick?.(event);
              const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
              if (event.defaultPrevented || event.button !== 0 || modified) return;
              const id = new URL(href, "http://staff.local").searchParams.get("entity");
              if (!id) return;
              event.preventDefault();
              setOpenId(id);
              router.push(href, { scroll: false });
            }}
          >
            {children}
          </a>
        );
      },
    [router],
  );

  const columns = useMemo<DataColumn<LegalEntitiesStaffRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.name.toLowerCase(),
        cell: (row) => (
          <PrimaryCell href={legalEntityPanelHref(search, row.id)} Link={PanelLink}>
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
        sortValue: (row) => row.stripeDueCount,
        defaultSortDirection: "desc",
        cell: (row) => row.stripe,
      },
      {
        id: "updated",
        header: "Updated",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.updatedAt,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
    ],
    [search, PanelLink],
  );

  const activeFilters = legalEntitiesFilterChips(search).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  // Clearing filters keeps the view: the tab is where the Stripe requirements view is chosen.
  const clearHref = legalEntitiesListHref(search, { q: null, status: null, kind: null });
  const openRow =
    rows.find((row) => row.id === openId) ??
    (props.preview && props.preview.row.id === openId ? props.preview.row : null);

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
        noResults={{
          title: "No legal entities match",
          description: "Try a different search, or clear the filters.",
        }}
        table={{
          label: "Legal entities",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultSort: { columnId: "updated", direction: "desc" },
          onRowOpen: (row) => openPanel(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for legal entity ${row.name}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => openPanel(row.id) },
              {
                id: "record",
                label: "Open full record",
                href: legalEntityRecordHref(search, row.id),
              },
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
      <LegalEntityQuickView
        row={openRow}
        preview={props.preview}
        search={search}
        onClose={closePanel}
        onImpersonate={actions.impersonate}
        extraActions={openRow ? actions.actionsFor(openRow) : []}
      />
      {actions.dialogs}
    </>
  );
}
