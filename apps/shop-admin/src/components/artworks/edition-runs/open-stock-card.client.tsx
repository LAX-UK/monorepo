"use client";

import { AddPrintsDialog } from "@/components/artworks/edition-runs/add-prints-dialog.client";
import { stockRefLabel } from "@/lib/edition-run-form";
import { LOW_STOCK_HINT, lowStockTitle, openStockFacts } from "@/server/domain/edition-run.vm";
import type { AdminOpenStock, AdminStockBatch } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataTable,
  EmptyState,
  Notice,
  Section,
  StaffButton,
  StatGrid,
  formatStaffDate,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

function refsText(batch: AdminStockBatch): string {
  const last = batch.firstStockRef + batch.quantity - 1;
  return batch.quantity === 1
    ? stockRefLabel(batch.firstStockRef)
    : `${stockRefLabel(batch.firstStockRef)} to ${stockRefLabel(last)}`;
}

const COLUMNS: readonly DataColumn<AdminStockBatch>[] = [
  {
    id: "added",
    header: "Added",
    cell: (row) => formatStaffDate(row.createdAt),
    mobile: "title",
  },
  { id: "prints", header: "Prints", numeric: true, cell: (row) => row.quantity, mobile: "badge" },
  { id: "refs", header: "Stock refs", cell: refsText, mobile: "meta" },
  {
    id: "split",
    header: "Artist / LAX",
    numeric: true,
    cell: (row) => `${row.artistCount} / ${row.laxCount}`,
    mobile: "meta",
  },
  {
    id: "state",
    header: "State",
    cell: (row) =>
      row.custody === "stored"
        ? row.storageLocation
          ? `Already printed · ${row.storageLocation}`
          : "Already printed"
        : "Printed to order",
    mobile: "meta",
  },
  { id: "by", header: "By", cell: (row) => row.addedByName ?? "LAX staff", hideBelow: "md" },
];

/**
 * An open edition's stock, for staff only: counts by state, the batches added, and "Add prints".
 * While 3 or fewer prints are on sale it says so. Shoppers never see these numbers.
 */
export function OpenStockCard({
  artworkId,
  title,
  stock,
  defaultSplit,
  canWrite,
}: {
  artworkId: string;
  title: string;
  stock: AdminOpenStock;
  defaultSplit: { artistPct: number; laxPct: number };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const low = lowStockTitle(stock);
  const addButton = canWrite ? (
    <StaffButton
      variant="primary"
      size="sm"
      icon={<Plus aria-hidden />}
      onClick={() => setAdding(true)}
    >
      Add prints
    </StaffButton>
  ) : null;

  return (
    <Section
      id="stock"
      title="Stock"
      description={`${title} · Open edition · default split ${defaultSplit.artistPct} % artist, ${defaultSplit.laxPct} % LAX`}
      {...(addButton ? { action: addButton } : {})}
      bodyClassName="flex flex-col gap-4 p-4"
    >
      {low ? (
        <Notice tone="warning" title={low}>
          {LOW_STOCK_HINT}
        </Notice>
      ) : null}
      <StatGrid label={`${title} stock`} items={openStockFacts(stock)} />
      <div className="overflow-hidden rounded-staff-lg border border-staff-line">
        <DataTable<AdminStockBatch>
          embedded
          label="Stock batches"
          columns={COLUMNS}
          data={stock.batches}
          getRowId={(row) => row.batchId}
          density="compact"
          defaultSort={{ columnId: "added", direction: "desc" }}
          stickyHeader={false}
          stickyToolbar={false}
          empty={
            <EmptyState
              size="compact"
              headingLevel="h3"
              title="No stock yet"
              description="Add the first prints when they are printed, or to print them to order."
            />
          }
        />
      </div>
      {canWrite ? (
        <AddPrintsDialog
          open={adding}
          onOpenChange={setAdding}
          artworkId={artworkId}
          defaultArtistPct={defaultSplit.artistPct}
          nextStockRef={stock.nextStockRef}
          onAdded={() => router.refresh()}
        />
      ) : null}
    </Section>
  );
}
