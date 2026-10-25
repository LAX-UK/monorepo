"use client";

import { NewHoldDialog } from "@/components/sales/new-hold-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { useWorkList } from "@/components/use-work-list.client";
import { releaseStockHold } from "@/server/application/admin-sales-actions.server";
import { editionLabel } from "@/server/domain/lookup-options.vm";
import { holdsList } from "@/server/domain/sales-lists.vm";
import {
  type HoldRow,
  presentHoldStatus,
  releaseHoldAvailability,
} from "@/server/domain/sales-records.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminStockHoldList } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
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
import { PanelRight, Plus, Unlock } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

function ReleaseHoldDialog({ hold, onClose }: { hold: HoldRow; onClose: () => void }) {
  const action = useAdminAction();
  const label = editionLabel(hold);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Release the hold on ${label}?`}
        description={`The edition goes back on sale straight away${hold.clientName ? `, and ${hold.clientName} loses their hold on it` : ""}. A released hold cannot be reinstated; create a new hold if the client still wants it.`}
        confirmLabel="Release hold"
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () => releaseStockHold({ holdId: hold.holdId, idempotencyKey: action.idempotencyKey }),
            `Hold on ${label} released`,
            "release this hold",
          );
          if (ok) onClose();
        }}
      >
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * Stock holds on the staff list template: a view per status with counts, search by artwork or
 * client, sorting by when a hold was made or when it ends, a record panel linked from the URL
 * (`?hold=`), New hold in the header and Release on every active hold.
 */
export function HoldsList({
  state,
  page,
  canHold,
  loadFailed = false,
}: {
  state: WorkListState<never>;
  page: AdminStockHoldList;
  canHold: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: holdsList,
    state,
    page,
    noun: { one: "hold", other: "holds" },
    search: { label: "Search holds", placeholder: "Search by artwork or client" },
  });
  const [creating, setCreating] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const releasing = page.items.find((hold) => hold.holdId === releasingId) ?? null;
  const opened = page.items.find((hold) => hold.holdId === list.panel.openId) ?? null;

  const releaseAction = (hold: HoldRow): OverflowAction | null =>
    releaseHoldAvailability(hold, { canRelease: canHold }).kind === "available"
      ? {
          id: "release",
          label: "Release hold…",
          icon: Unlock,
          onSelect: () => setReleasingId(hold.holdId),
        }
      : null;

  const columns = useMemo<DataColumn<HoldRow>[]>(
    () => [
      {
        id: "edition",
        header: "Edition",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={list.panelHref(row.holdId)} Link={list.panel.PanelLink}>
            {editionLabel(row)}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentHoldStatus} />,
      },
      {
        id: "client",
        header: "Held for",
        width: "24%",
        mobile: "meta",
        cell: (row) => (row.clientName ? <PersonCell name={row.clientName} /> : null),
      },
      {
        id: "expires",
        header: "Ends",
        width: "184px",
        sortable: true,
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.expiresAt} withTime />,
      },
      {
        id: "created",
        header: "Created",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.createdAt ? <StaffDate value={row.createdAt} withTime /> : null),
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const openedRelease = opened ? releaseAction(opened) : null;

  return (
    <>
      <ListPage<HoldRow>
        title="Stock holds"
        description="Editions held back for a client. A hold ends on its own; release one early if the sale falls through."
        Link={list.Link}
        listKey="lax-admin.holds"
        primaryAction={
          canHold ? (
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              New hold
            </StaffButton>
          ) : undefined
        }
        views={list.views}
        search={list.search}
        activeFilters={list.searchChip}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Stock holds did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(holdsList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "plinth",
          title: state.view === "active" ? "No editions are on hold" : "No stock holds",
          description:
            "Hold an edition for a client and it will be listed here until it ends or is released.",
          ...(canHold
            ? {
                action: (
                  <StaffButton
                    variant="secondary"
                    icon={<Plus aria-hidden />}
                    onClick={() => setCreating(true)}
                  >
                    New hold
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{
          title: "No holds match",
          description: "Try another artwork or client, or clear the search.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.holdId,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["created"],
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.holdId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the hold on ${editionLabel(row)}`,
            actions: (row) =>
              [
                {
                  id: "open",
                  label: "Open details",
                  icon: PanelRight,
                  onSelect: () => list.panel.show(row.holdId),
                },
                releaseAction(row),
              ].filter((action): action is OverflowAction => action !== null),
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
        title={opened ? editionLabel(opened) : "Stock hold"}
        status={
          opened ? <MappedStatusBadge status={opened.status} present={presentHoldStatus} /> : null
        }
        meta={
          opened
            ? [
                { label: "Held for", value: opened.clientName ?? "" },
                {
                  label: "Ends",
                  value: formatStaffDateTime(opened.expiresAt, { zoneLabel: true }),
                },
              ]
            : []
        }
        summary={
          opened
            ? [
                { label: "Broker", value: opened.brokerName ?? null },
                { label: "Note", value: opened.note ?? null },
                {
                  label: "Created",
                  value: opened.createdAt
                    ? formatStaffDateTime(opened.createdAt, { zoneLabel: true })
                    : null,
                },
                { label: "Hold ID", value: opened.holdId, copyValue: opened.holdId },
              ]
            : []
        }
        footer={
          opened && openedRelease ? (
            <StaffButton
              variant="secondary"
              icon={<Unlock aria-hidden />}
              onClick={() => setReleasingId(opened.holdId)}
            >
              Release hold
            </StaffButton>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {creating ? <NewHoldDialog open onOpenChange={setCreating} /> : null}
      {releasing ? (
        <ReleaseHoldDialog hold={releasing} onClose={() => setReleasingId(null)} />
      ) : null}
    </>
  );
}
