"use client";

import { useWorkList } from "@/components/use-work-list.client";
import { bidClientHref, clientPageHref } from "@/server/domain/client-record.vm";
import { partyKindLabel } from "@/server/domain/lookup-options.vm";
import { clientsList } from "@/server/domain/people-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminPartyList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  ListPage,
  type OverflowAction,
  PersonCell,
  StaffButton,
  StaffDate,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, ExternalLink, PanelRight } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

type ClientRow = AdminPartyList["items"][number];

const count = (value: number | undefined) => (value === undefined ? null : value);

/**
 * Collectors and galleries on the staff list template: views by kind with counts, search by
 * name or email, newest first on the server (switchable), 50 a page, a record panel linked from
 * the URL (`?client=`) and a "…" menu on every row. Bid activity stays in Bid admin, linked
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
  const opened = page.items.find((row) => row.partyId === list.panel.openId) ?? null;

  const columns = useMemo<DataColumn<ClientRow>[]>(
    () => [
      {
        id: "name",
        header: "Client",
        mobile: "title",
        cell: (row) => (
          <PersonCell
            name={row.displayName}
            secondary={row.email ?? null}
            href={list.panelHref(row.partyId)}
            Link={list.panel.PanelLink}
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
    [list.panelHref, list.panel.PanelLink],
  );

  const actionsFor = (row: ClientRow): OverflowAction[] => {
    const bid = bidClientHref(bidPublicUrl, row.email ?? null);
    return [
      {
        id: "open",
        label: "Open details",
        icon: PanelRight,
        onSelect: () => list.panel.show(row.partyId),
      },
      {
        id: "page",
        label: "Open client page",
        icon: ArrowUpRight,
        href: clientPageHref(row.partyId),
      },
      ...(bid ? [{ id: "bid", label: "Find in Bid admin", icon: ExternalLink, href: bid }] : []),
    ];
  };

  const openedBid = opened ? bidClientHref(bidPublicUrl, opened.email ?? null) : null;

  return (
    <>
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
        noResults={{
          title: "No clients match",
          description: "Try another name or email, or clear the search.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.partyId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.partyId),
          activeRowId: list.panel.openId,
          rowActions: { label: (row) => `Actions for ${row.displayName}`, actions: actionsFor },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.displayName ?? "Client"}
        status={
          opened ? <StatusBadge tone="neutral">{partyKindLabel(opened.kind)}</StatusBadge> : null
        }
        meta={
          opened
            ? [
                {
                  label: "Joined",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? [
                ...(opened.email
                  ? [{ label: "Email", value: opened.email, copyValue: opened.email }]
                  : []),
                ...(opened.editionCount !== undefined
                  ? [{ label: "Editions owned", value: String(opened.editionCount), numeric: true }]
                  : []),
                ...(opened.paidOrderCount !== undefined
                  ? [{ label: "Paid orders", value: String(opened.paidOrderCount), numeric: true }]
                  : []),
                { label: "Client ID", value: opened.partyId, copyValue: opened.partyId },
              ]
            : []
        }
        footer={
          opened ? (
            <>
              {openedBid ? (
                <StaffButton asChild variant="secondary" icon={<ExternalLink aria-hidden />}>
                  <a href={openedBid}>Find in Bid admin</a>
                </StaffButton>
              ) : null}
              <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
                <Link href={clientPageHref(opened.partyId)}>Open client page</Link>
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>
    </>
  );
}
