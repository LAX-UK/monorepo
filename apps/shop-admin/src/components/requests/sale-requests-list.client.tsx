"use client";

import {
  ApproveRequestDialog,
  DeclineRequestDialog,
  type SaleRequestRow,
} from "@/components/requests/sale-request-dialogs.client";
import { knownFacts, useWorkList } from "@/components/use-work-list.client";
import { requestedEditionsLabel } from "@/server/domain/sale-authority.vm";
import { saleRequestsList } from "@/server/domain/sales-lists.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminSaleAuthorityRequestList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { Check, PanelRight, X } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

const presentRequestStatus = presentStatus("saleRequest");

/**
 * Sale limit requests on the staff list template: owners asking to sell more editions than they
 * are authorised for. Waiting requests first, a view per outcome with counts, search by artwork
 * or owner, newest first on the server, and a record panel linked from the URL (`?request=`).
 * Approve asks how many editions and on what evidence; decline asks for the reason the owner
 * sees.
 */
export function SaleRequestsList({
  state,
  page,
  canDecide,
  loadFailed = false,
}: {
  state: WorkListState<never>;
  page: AdminSaleAuthorityRequestList;
  canDecide: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: saleRequestsList,
    state,
    page,
    noun: { one: "request", other: "requests" },
    search: { label: "Search requests", placeholder: "Search by artwork or owner" },
  });
  const [deciding, setDeciding] = useState<{ id: string; decision: "approve" | "decline" } | null>(
    null,
  );
  const decidingRow = page.items.find((row) => row.requestId === deciding?.id) ?? null;
  const opened = page.items.find((row) => row.requestId === list.panel.openId) ?? null;
  const decidable = (row: SaleRequestRow) => canDecide && row.status === "pending";

  const columns = useMemo<DataColumn<SaleRequestRow>[]>(
    () => [
      {
        id: "artwork",
        header: "Artwork",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.requestId)}
            Link={list.panel.PanelLink}
            secondary={requestedEditionsLabel(row.requestedCount)}
          >
            {row.artworkTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "160px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentRequestStatus} />,
      },
      {
        id: "owner",
        header: "Owner",
        width: "28%",
        mobile: "meta",
        cell: (row) => <PersonCell name={row.ownerDisplayName} />,
      },
      {
        id: "created",
        header: "Sent",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const decideActions = (row: SaleRequestRow): OverflowAction[] =>
    decidable(row)
      ? [
          {
            id: "approve",
            label: "Approve…",
            icon: Check,
            onSelect: () => setDeciding({ id: row.requestId, decision: "approve" }),
          },
          {
            id: "decline",
            label: "Decline…",
            icon: X,
            tone: "danger",
            onSelect: () => setDeciding({ id: row.requestId, decision: "decline" }),
          },
        ]
      : [];

  return (
    <>
      <ListPage<SaleRequestRow>
        title="Sale limit requests"
        description="Owners asking to sell more editions than they are authorised for. Approve or decline each request; the owner sees the answer in LAX Account."
        Link={list.Link}
        listKey="lax-admin.sale-requests"
        views={list.views}
        search={list.search}
        activeFilters={list.searchChip}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Sale limit requests did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(saleRequestsList.href(state)),
              }
            : null
        }
        empty={
          state.view === "pending"
            ? {
                illustration: "ledger",
                title: "No requests waiting",
                description:
                  "Owners ask for a higher sale limit from LAX Account. New requests appear here for review.",
              }
            : {
                illustration: "ledger",
                title: "No requests here",
                description: "Requests move here once they are answered or withdrawn.",
              }
        }
        noResults={{
          title: "No requests match",
          description: "Try another artwork or owner, or clear the search.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.requestId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.requestId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${row.ownerDisplayName}’s request on ${row.artworkTitle}`,
            actions: (row) => [
              {
                id: "open",
                label: "Open details",
                icon: PanelRight,
                onSelect: () => list.panel.show(row.requestId),
              },
              ...decideActions(row),
            ],
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened?.artworkTitle ?? "Sale limit request"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentRequestStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Owner", value: opened.ownerDisplayName },
                { label: "Request", value: requestedEditionsLabel(opened.requestedCount) },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Their note", value: opened.note ?? null },
                ...(opened.status === "rejected"
                  ? [{ label: "Reason given", value: opened.declineReason ?? null }]
                  : []),
                {
                  label: "Sent",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
                {
                  label: "Answered",
                  value: opened.handledAt
                    ? formatStaffDateTime(opened.handledAt, { zoneLabel: true })
                    : null,
                },
                { label: "Request ID", value: opened.requestId, copyValue: opened.requestId },
              ])
            : []
        }
        footer={
          opened && decidable(opened) ? (
            <>
              <StaffButton
                variant="secondary"
                onClick={() => setDeciding({ id: opened.requestId, decision: "decline" })}
              >
                Decline
              </StaffButton>
              <StaffButton
                variant="primary"
                icon={<Check aria-hidden />}
                onClick={() => setDeciding({ id: opened.requestId, decision: "approve" })}
              >
                Approve
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {decidingRow && deciding?.decision === "approve" ? (
        <ApproveRequestDialog request={decidingRow} onClose={() => setDeciding(null)} />
      ) : null}
      {decidingRow && deciding?.decision === "decline" ? (
        <DeclineRequestDialog request={decidingRow} onClose={() => setDeciding(null)} />
      ) : null}
    </>
  );
}
