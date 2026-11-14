"use client";

import { useWorkList } from "@/components/use-work-list.client";
import { bidClientHref, clientPageHref } from "@/server/domain/client-record.vm";
import { partyKindLabel } from "@/server/domain/lookup-options.vm";
import { clientsList } from "@/server/domain/people-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminPartyList } from "@auction/shop-contracts";
import {
  type DataColumn,
  ListPage,
  type OverflowAction,
  PersonCell,
  StaffDate,
} from "@auction/staff-ui";
import { ArrowUpRight, ExternalLink } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useMemo } from "react";

type ClientRow = AdminPartyList["items"][number];

const count = (value: number | undefined) => (value === undefined ? null : value);

/**
 * Collectors and galleries on the staff list template: views by kind with counts, search by
 * name or email, newest first on the server (or A to Z), 50 a page, and a "…" menu on every row.
 * A row opens the client's page, which remembers this list for its way back. Bid activity stays in Bid admin, linked
 * rather than copied.
 */
export function ClientsList({
  state,
  page,
  assignedOnly,
  bidPublicUrl,
  loadFailed = false,
}: {
  state: WorkListState<never>;
  page: AdminPartyList;
  /** A broker sees only the clients assigned to them. */
  assignedOnly: boolean;
  bidPublicUrl: string | undefined;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: clientsList,
    state,
    page,
    noun: { one: "client", other: "clients" },
    search: { label: "Search clients", placeholder: "Search by name or email" },
  });
  const rowHref = useCallback(
    (row: ClientRow) => clientsList.recordHref(state, clientPageHref(row.partyId)),
    [state],
  );

  const columns = useMemo<DataColumn<ClientRow>[]>(
    () => [
      {
        id: "name",
        header: "Client",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "asc",
        cell: (row) => (
          <PersonCell
            name={row.displayName}
            secondary={row.email ?? null}
            href={rowHref(row)}
            Link={Link}
          />
        ),
      },
      {
        id: "kind",
        header: "Type",
        width: "120px",
        mobile: "meta",
        cell: (row) => partyKindLabel(row.kind),
      },
      {
        id: "editions",
        header: "Editions owned",
        width: "144px",
        numeric: true,
        hideBelow: "md",
        mobile: "hidden",
        cell: (row) => count(row.editionCount),
      },
      {
        id: "orders",
        header: "Paid orders",
        width: "128px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => count(row.paidOrderCount),
      },
      {
        id: "joined",
        header: "Joined",
        width: "136px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} />,
      },
    ],
    [rowHref],
  );

  const actionsFor = (row: ClientRow): OverflowAction[] => {
    const bid = bidClientHref(bidPublicUrl, row.email ?? null);
    return [
      {
        id: "page",
        label: "Open client page",
        icon: ArrowUpRight,
        href: rowHref(row),
      },
      ...(bid ? [{ id: "bid", label: "Find in Bid admin", icon: ExternalLink, href: bid }] : []),
    ];
  };

  return (
    <ListPage<ClientRow>
      title="Clients"
      description={
        assignedOnly
          ? "The collectors and galleries assigned to you, with their Shop and lax.art activity."
          : "Collectors and galleries, with their editions, orders, sale limits and payouts."
      }
      Link={list.Link}
      listKey="lax-admin.clients"
      views={list.views}
      search={list.search}
      activeFilters={list.searchChip}
      onClearFilters={list.clearFilters}
      loading={list.pending}
      filtered={list.filtered}
      error={
        loadFailed
          ? {
              title: "Clients did not load",
              description: "Something went wrong on our side. Try again in a moment.",
              onRetry: () => list.navigate(clientsList.href(state)),
            }
          : null
      }
      empty={{
        illustration: "plinth",
        title: assignedOnly ? "No clients assigned to you yet" : "No clients yet",
        description:
          "Collectors and galleries appear here after their first order, purchase or edition.",
      }}
      noResults={{ noun: "clients" }}
      table={{
        columns,
        data: page.items,
        getRowId: (row) => row.partyId,
        defaultDensity: "comfortable",
        ...list.sort,
        rowHref,
        rowActions: { label: (row) => `Actions for ${row.displayName}`, actions: actionsFor },
      }}
      pageSize={list.pageSize}
      pagination={list.pagination}
    />
  );
}
