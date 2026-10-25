"use client";

import { IssueInvoiceDialog } from "@/components/sales/issue-invoice-dialog.client";
import { NewOriginalSaleDialog } from "@/components/sales/new-original-sale-dialog.client";
import { useWorkList } from "@/components/use-work-list.client";
import { originalSalesList } from "@/server/domain/sales-lists.vm";
import {
  type OriginalSaleRow,
  issueInvoiceAvailability,
  presentOriginalSaleStatus,
} from "@/server/domain/sales-records.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminOriginalSaleList } from "@auction/shop-contracts";
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
  StaffMoney,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import { FileText, PanelRight, Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

/**
 * Original sales on the staff list template: reserve an original, then invoice it from its row
 * or its panel. A view per status with counts, search by artwork or buyer, newest first on the
 * server, and a record panel linked from the URL (`?sale=`).
 */
export function OriginalSalesList({
  state,
  page,
  canSell,
  loadFailed = false,
}: {
  state: WorkListState<never>;
  page: AdminOriginalSaleList;
  canSell: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: originalSalesList,
    state,
    page,
    noun: { one: "sale", other: "sales" },
    search: { label: "Search original sales", placeholder: "Search by artwork, buyer or email" },
  });
  const [creating, setCreating] = useState(false);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const invoicing = page.items.find((sale) => sale.saleId === invoicingId) ?? null;
  const opened = page.items.find((sale) => sale.saleId === list.panel.openId) ?? null;

  const invoiceAction = (sale: OriginalSaleRow): OverflowAction | null => {
    const availability = issueInvoiceAvailability(sale, { canInvoice: canSell });
    if (availability.kind === "hidden") return null;
    return {
      id: "invoice",
      label: `Issue ${formatStaffMoney(sale.salePricePence)} invoice…`,
      icon: FileText,
      ...(availability.kind === "blocked"
        ? { disabledReason: availability.reason }
        : { onSelect: () => setInvoicingId(sale.saleId) }),
    };
  };

  const columns = useMemo<DataColumn<OriginalSaleRow>[]>(
    () => [
      {
        id: "artwork",
        header: "Artwork",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={list.panelHref(row.saleId)} Link={list.panel.PanelLink}>
            {row.artworkTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "136px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <MappedStatusBadge status={row.status} present={presentOriginalSaleStatus} />
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "26%",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) =>
          row.buyerName ? <PersonCell name={row.buyerName} secondary={row.buyerEmail} /> : null,
      },
      {
        id: "price",
        header: "Price",
        width: "128px",
        numeric: true,
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffMoney minor={row.salePricePence} />,
      },
      {
        id: "created",
        header: "Created",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const openedInvoice = opened ? invoiceAction(opened) : null;

  return (
    <>
      <ListPage<OriginalSaleRow>
        title="Original sales"
        description="Sell the original of an artwork: reserve it, issue the buyer an invoice, and it is assigned once they pay."
        Link={list.Link}
        listKey="lax-admin.original-sales"
        primaryAction={
          canSell ? (
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              Reserve original
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
                title: "Original sales did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(originalSalesList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "ledger",
          title: "No original sales yet",
          description:
            "Reserve an original for a buyer and it will appear here as it moves towards payment.",
          ...(canSell
            ? {
                action: (
                  <StaffButton
                    variant="secondary"
                    icon={<Plus aria-hidden />}
                    onClick={() => setCreating(true)}
                  >
                    Reserve original
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{
          title: "No original sales match",
          description: "Try another artwork or buyer, or clear the search.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.saleId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.saleId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the sale of ${row.artworkTitle}`,
            actions: (row) =>
              [
                {
                  id: "open",
                  label: "Open details",
                  icon: PanelRight,
                  onSelect: () => list.panel.show(row.saleId),
                },
                invoiceAction(row),
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
        title={opened?.artworkTitle ?? "Original sale"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentOriginalSaleStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Buyer", value: opened.buyerName ?? "" },
                { label: "Price", value: formatStaffMoney(opened.salePricePence) },
              ]
            : []
        }
        summary={
          opened
            ? [
                {
                  label: "Buyer email",
                  value: opened.buyerEmail ?? null,
                  ...(opened.buyerEmail ? { copyValue: opened.buyerEmail } : {}),
                },
                {
                  label: "Reservation ends",
                  value: opened.reservationExpiresAt
                    ? formatStaffDateTime(opened.reservationExpiresAt, { zoneLabel: true })
                    : "Held until invoiced",
                },
                {
                  label: "Created",
                  value: formatStaffDateTime(opened.createdAt, { zoneLabel: true }),
                },
                { label: "Sale ID", value: opened.saleId, copyValue: opened.saleId },
              ]
            : []
        }
        footer={
          opened && openedInvoice ? (
            <StaffButton
              variant="primary"
              icon={<FileText aria-hidden />}
              {...(openedInvoice.disabledReason
                ? { disabledReason: openedInvoice.disabledReason }
                : {})}
              onClick={() => setInvoicingId(opened.saleId)}
            >
              Issue {formatStaffMoney(opened.salePricePence)} invoice
            </StaffButton>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {creating ? <NewOriginalSaleDialog open onOpenChange={setCreating} /> : null}
      {invoicing ? (
        <IssueInvoiceDialog
          sale={invoicing}
          open
          onOpenChange={(open) => {
            if (!open) setInvoicingId(null);
          }}
        />
      ) : null}
    </>
  );
}
