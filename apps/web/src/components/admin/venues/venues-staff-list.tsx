"use client";

import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { useVenueActions } from "@/components/admin/venues/use-venue-actions";
import { VenueQuickView } from "@/components/admin/venues/venue-quick-view";
import { searchAdminLegalEntitiesBrowseAction } from "@/lib/actions/admin-legal-entities-browse";
import {
  type VenuesListSearch,
  type VenuesStaffRow,
  venuePanelHref,
  venuesListHref,
} from "@/lib/admin/venues/venues-staff-list.vm";
import {
  CellLink,
  type DataColumn,
  DataViews,
  type EntityOption,
  FilterSheet,
  ListPage,
  PrimaryCell,
  StaffButton,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
  TableSearch,
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type VenuesStaffListProps = {
  rows: VenuesStaffRow[];
  search: VenuesListSearch;
  views: StaffDataView[];
  activeView: string;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  /** The organisation the list is filtered to, named for the filter sheet. */
  organisation: { id: string | null; name: string | null };
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  listError: string | null;
  filtered: boolean;
};

async function searchOrganisations(query: string): Promise<EntityOption[]> {
  const result = await searchAdminLegalEntitiesBrowseAction({
    ...(query ? { q: query } : {}),
    limit: 25,
    offset: 0,
  });
  if (!result.ok) return [];
  return (result.data?.rows ?? []).map((row) => ({ id: row.id, label: row.displayName }));
}

/**
 * Bid's reusable onsite venues on the staff list template: active or all venues, search, an
 * organisation filter, and a record panel deep-linked with `?venue=`. Every row's `…` menu opens
 * the venue, its page, editor and organisation, and archives it after a confirmation.
 */
export function VenuesStaffList(props: VenuesStaffListProps) {
  const { rows, search, organisation } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback((id: string | null) => venuePanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "venue",
    initialId: typeof search.venue === "string" ? search.venue : null,
    hrefFor: panelHref,
  });
  const venueActions = useVenueActions();
  const q = typeof search.q === "string" ? search.q : "";

  const columns = useMemo<DataColumn<VenuesStaffRow>[]>(
    () => [
      {
        id: "venue",
        header: "Venue",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.name.toLocaleLowerCase("en-GB"),
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={panel.PanelLink} secondary={row.slugLabel}>
            {row.name}
          </PrimaryCell>
        ),
      },
      {
        id: "organisation",
        header: "Organisation",
        sortable: true,
        sortValue: (row) => row.organisation.toLocaleLowerCase("en-GB"),
        width: "240px",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => (
          <CellLink href={row.organisationHref} Link={ListLink}>
            {row.organisation}
          </CellLink>
        ),
      },
      {
        id: "address",
        header: "Address",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.address,
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
        id: "updated",
        header: "Updated",
        sortable: true,
        sortValue: (row) => row.updatedAt,
        defaultSortDirection: "desc",
        width: "120px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.updatedAt} />,
      },
    ],
    [panelHref, panel.PanelLink, ListLink],
  );

  const activeFilters = props.filterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const openRow = rows.find((row) => row.id === panel.openId) ?? null;

  return (
    <>
      <ListPage<VenuesStaffRow>
        title="Venues"
        description="Reusable onsite gallery and branch locations. Only venues owned by the sale operator can be attached to a sale."
        Link={ListLink}
        listKey="bid-admin.venues"
        access="full"
        primaryAction={
          <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
            <Link href="/admin/venues/new">New venue</Link>
          </StaffButton>
        }
        views={<DataViews views={props.views} activeId={props.activeView} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search venues"
            placeholder="Search by venue name"
            value={q}
            onSearch={(next) => navigate(venuesListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter venues"
            description="Archived venues are included from the tabs above the list."
            sections={[
              {
                kind: "entity",
                id: "legalEntityId",
                label: "Organisation",
                value: organisation.id ?? "",
                search: searchOrganisations,
                selected:
                  organisation.id && organisation.name
                    ? { id: organisation.id, label: organisation.name }
                    : null,
                placeholder: "Any organisation",
                searchPlaceholder: "Search organisations",
                emptyText: "No organisations match.",
              },
            ]}
            onApply={(values) =>
              navigate(
                venuesListHref(search, { legalEntityId: (values.legalEntityId as string) || null }),
              )
            }
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(venuesListHref(search, { q: null, legalEntityId: null }))}
        loading={pending}
        filtered={props.filtered}
        error={
          props.listError
            ? { description: props.listError, onRetry: () => navigate(venuesListHref(search, {})) }
            : null
        }
        empty={{
          title: "No venues yet",
          description: "Create a reusable onsite venue before setting up gallery sales.",
          action: (
            <StaffButton asChild size="sm" variant="primary">
              <Link href="/admin/venues/new">New venue</Link>
            </StaffButton>
          ),
        }}
        noResults={{ noun: "venues" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["updated"],
          defaultSort: { columnId: "venue", direction: "asc" },
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for venue ${row.name}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open venue page", href: row.href },
              { id: "edit", label: "Edit venue", href: row.editHref },
              { id: "organisation", label: "Open organisation", href: row.organisationHref },
              ...venueActions.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(venuesListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <VenueQuickView
        row={openRow}
        onClose={() => panel.show(null)}
        actions={openRow ? venueActions.actionsFor(openRow) : []}
      />
      {venueActions.dialogs}
    </>
  );
}
