"use client";

import { IssueInvoiceDialog } from "@/components/sales/issue-invoice-dialog.client";
import { NewOriginalSaleDialog } from "@/components/sales/new-original-sale-dialog.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  type OriginalSaleRow,
  issueInvoiceAvailability,
  presentOriginalSaleStatus,
} from "@/server/domain/sales-records.vm";
import type { AdminOriginalSaleList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  PageHeader,
  StaffButton,
  TablePagination,
  formatGbp,
  formatStaffDateTime,
  useTableDensity,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

/** Original sales: reserve one, then invoice it from its row; the pipeline shows where each stands. */
export function OriginalSalesList({
  page,
  cursor,
  canSell,
}: {
  page: AdminOriginalSaleList;
  cursor: string | null;
  canSell: boolean;
}) {
  const { pending, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("original-sales");
  const [creating, setCreating] = useState(false);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const invoicing = page.items.find((sale) => sale.saleId === invoicingId) ?? null;

  const columns = useMemo<DataColumn<OriginalSaleRow>[]>(
    () => [
      {
        id: "artwork",
        header: "Artwork",
        mobile: "title",
        cell: (row) => <span className="font-medium text-staff-fg">{row.artworkTitle}</span>,
      },
      {
        id: "buyer",
        header: "Buyer",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) => row.buyerName ?? <span className="text-staff-subtle">—</span>,
      },
      {
        id: "price",
        header: "Price",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.salePricePence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => formatGbp(row.salePricePence),
      },
      {
        id: "status",
        header: "Status",
        width: "144px",
        mobile: "badge",
        cell: (row) => (
          <MappedStatusBadge status={row.status} present={presentOriginalSaleStatus} />
        ),
      },
      {
        id: "created",
        header: "Created",
        width: "176px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.createdAt,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => <time dateTime={row.createdAt}>{formatStaffDateTime(row.createdAt)}</time>,
      },
      {
        id: "actions",
        header: "Actions",
        width: "144px",
        mobile: "hidden",
        cell: (row) => {
          const availability = issueInvoiceAvailability(row, { canInvoice: canSell });
          if (availability.kind === "hidden") return null;
          return (
            <StaffButton
              size="sm"
              variant="secondary"
              aria-label={`Issue the invoice for ${row.artworkTitle}`}
              {...(availability.kind === "blocked" ? { disabledReason: availability.reason } : {})}
              onClick={() => setInvoicingId(row.saleId)}
            >
              Issue invoice
            </StaffButton>
          );
        },
      },
    ],
    [canSell],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Original sales"
        description="Sell the original of an artwork: reserve it, issue the buyer an invoice, and it is assigned once they pay."
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
      />
      <DataTable
        label="Original sales"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.saleId}
        defaultSort={{ columnId: "created", direction: "desc" }}
        density={density}
        loading={pending}
        toolbar={<DataTableToolbar end={<DensityToggle value={density} onChange={setDensity} />} />}
        empty={
          <EmptyState
            title="No original sales yet"
            description="Reserve an original for a buyer and it will appear here as it moves towards payment."
          />
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "sale" : "sales"} on this page`}
              prevHref={cursor ? "/original-sales" : null}
              prevLabel="First page"
              nextHref={
                page.nextCursor
                  ? `/original-sales?cursor=${encodeURIComponent(page.nextCursor)}`
                  : null
              }
              Link={ListLink}
            />
          ) : null
        }
      />
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
    </div>
  );
}
