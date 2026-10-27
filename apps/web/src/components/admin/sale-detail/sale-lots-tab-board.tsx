"use client";

import { useLotActions } from "@/components/admin/lots/use-lot-actions";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { AdminSaleLotQrPrintButton } from "@/components/admin/qr-code/admin-sale-lot-qr-print-button";
import { AttachExistingLotDialog } from "@/components/admin/sale-lots-tab/attach-existing-lot-dialog";
import { EmergencyAddLotDialog } from "@/components/admin/sale-lots-tab/emergency-add-lot-dialog";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { ExportButton } from "@/components/exports/export-button";
import { adminReturnLotToInventoryResultAction } from "@/lib/actions/admin";
import {
  adminDetachLotFromSaleResultAction,
  adminSetLotStatusResultAction,
} from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  type SaleLotsFilterContext,
  type SaleLotsLens,
  filterSaleLotsByLens,
  matchesSaleLotSearch,
  resolveSaleLotsBoardMode,
  saleLotsBoardFilters,
} from "@/lib/data/view-models/sale-lots-tab.vm";
import {
  type DataColumn,
  DataTableToolbar,
  EmptyValue,
  PrimaryCell,
  SegmentedControl,
  StaffButton,
  StaffDate,
  StaffMoney,
  StatusBadge,
  TableSearch,
  formatStaffMoney,
  rowActionsColumn,
  staffButtonVariants,
} from "@auction/staff-ui";
import type { CategoryNode, Lot, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  saleId: string;
  sale: {
    status: SaleStatus;
    deliveryMode: SaleDeliveryMode;
    startTime: Date;
    endTime: Date;
  };
  lots: Lot[];
  canManageAuction?: boolean;
  categories?: CategoryNode[];
  englishOnlyAuctionsLocked?: boolean;
  /** Each lot's artist name by artist ID. */
  artistNameById?: Readonly<Record<string, string>>;
};

type SaleLotRow = {
  id: string;
  lot: Lot;
  lotNumber: number | null;
  title: string;
  thumbnailUrl: string | null;
  endsAt: Date;
  /** Major-unit prices converted to pence, null when there is none. */
  estimate: { low: number; high: number } | null;
  reserve: number | null;
  /** The bid to date, or the hammer once sold; null when bidding has not started or never will. */
  current: number | null;
  unsold: boolean;
};

/** "£4,000", as the lists show estimates: whole pounds when there are no pence. */
function wholePounds(pence: number): string {
  return formatStaffMoney(pence).replace(/\.00$/, "");
}

function minor(major: string | null | undefined): number | null {
  if (major === null || major === undefined || major === "") return null;
  const value = Number.parseFloat(major);
  return Number.isNaN(value) ? null : Math.round(value * 100);
}

function toRow(lot: Lot): SaleLotRow {
  const estimate = lot.marketingDetails?.estimate;
  const low = minor(estimate?.low);
  const high = minor(estimate?.high);
  const sold = lot.status === "ended" && Boolean(lot.winnerId);
  const bidding = lot.status === "active" || sold;
  const current = minor(lot.currentPrice);
  return {
    id: lot.id,
    lot,
    lotNumber: lot.lotNumber,
    title: lot.title,
    thumbnailUrl: lot.images[0] ?? null,
    endsAt: lot.endTime,
    estimate: low !== null && high !== null ? { low, high } : null,
    reserve: minor(lot.reservePrice),
    current: bidding && current !== null && current > 0 ? current : null,
    unsold: lot.status === "ended" && !lot.winnerId,
  };
}

/**
 * A sale's lots as one section: the lots with their estimate, reserve, bid and closing time, a
 * `…` menu on every row, and the ways to add lots (new, from inventory) in the section's header.
 * Consequential row actions ask first through the kit confirm.
 */
export function SaleLotsTabBoard({
  saleId,
  sale,
  lots,
  canManageAuction = false,
  categories = [],
  englishOnlyAuctionsLocked = false,
  artistNameById = {},
}: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const boardMode = resolveSaleLotsBoardMode(sale.status);
  const filters = saleLotsBoardFilters(boardMode);
  const [lens, setLens] = useState<SaleLotsLens>("all");
  const [search, setSearch] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const canEditDraft = sale.status === "draft";
  const canAddLots =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const lotActions = useLotActions({
    canManageCatalog: canManageAuction,
    canManageAuction,
    canDecideWithdrawals: false,
  });

  const saleContext = useMemo<SaleLotsFilterContext>(
    () => ({
      deliveryMode: sale.deliveryMode,
      startTime: sale.startTime,
      endTime: sale.endTime,
    }),
    [sale.deliveryMode, sale.startTime, sale.endTime],
  );

  const rows = useMemo(
    () =>
      filterSaleLotsByLens(lots, lens, saleContext, boardMode)
        .filter((lot) =>
          matchesSaleLotSearch({ title: lot.title, lotNumber: lot.lotNumber }, search),
        )
        .map(toRow),
    [lots, lens, saleContext, boardMode, search],
  );

  const returnEligible = lots.filter(
    (lot) =>
      (lot.status === "ended" || lot.status === "cancelled" || lot.status === "voided") &&
      !lot.winnerId,
  );

  const detach = (lot: Lot) =>
    confirm.ask({
      title: `Remove ${lot.title} from this sale?`,
      description:
        "The lot returns to inventory as a standalone draft, ready to attach to another sale.",
      confirmLabel: "Remove from sale",
      run: () => adminDetachLotFromSaleResultAction(saleId, lot.id),
      success: `${lot.title} removed from the sale`,
    });

  const endLot = (lot: Lot) =>
    confirm.ask({
      title: `End ${lot.title} now?`,
      description: "Bidding on this lot stops now. This cannot be undone.",
      confirmLabel: "End lot",
      tone: "danger",
      stepUpAction: "end this lot",
      run: () => adminSetLotStatusResultAction(saleId, lot.id, "ended"),
      success: `${lot.title} ended`,
    });

  const returnAll = () =>
    confirm.ask({
      title: `Return ${returnEligible.length} lot${returnEligible.length === 1 ? "" : "s"} to inventory?`,
      description:
        "Each lot is reset to a draft and taken out of this cancelled sale, ready to be used again. Lots that sold stay with their buyers.",
      confirmLabel: "Return lots",
      tone: "danger",
      reason: { label: "Reason", description: "Kept in the audit log.", maxLength: 500 },
      run: async ({ reason }) => {
        for (const lot of returnEligible) {
          const result = await adminReturnLotToInventoryResultAction(lot.id, {
            reason,
            confirmVoided: lot.status === "voided",
          });
          if (!result.ok) {
            return { ...result, error: `${lot.title}: ${result.error}` };
          }
        }
        return { ok: true as const };
      },
      success: "Lots returned to inventory",
    });

  const artistOf = (row: SaleLotRow) =>
    row.lot.artistId ? (artistNameById[row.lot.artistId] ?? null) : null;

  const columns: DataColumn<SaleLotRow>[] = [
    {
      id: "number",
      header: "Lot no.",
      width: "76px",
      numeric: true,
      sortable: true,
      sortValue: (row) => row.lotNumber,
      mobile: "meta",
      cell: (row) => (row.lotNumber === null ? <EmptyValue /> : row.lotNumber),
    },
    {
      id: "title",
      header: "Lot",
      sortable: true,
      sortValue: (row) => row.title.toLowerCase(),
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/admin/lots/${row.id}`}
          Link={Link}
          thumbnail={{ src: row.thumbnailUrl, missingLabel: "No photos yet" }}
          secondary={artistOf(row) ?? undefined}
        >
          {row.title}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "120px",
      truncate: false,
      mobile: "badge",
      cell: (row) => {
        const status = staffStatus("lot", row.lot.status, {
          lot: { winnerId: row.lot.winnerId },
        });
        return (
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        );
      },
    },
    {
      id: "estimate",
      header: "Estimate",
      width: "136px",
      numeric: true,
      hideBelow: "lg",
      mobile: "hidden",
      cell: (row) =>
        row.estimate ? (
          <span className="tabular-nums">
            {wholePounds(row.estimate.low)}–{wholePounds(row.estimate.high)}
          </span>
        ) : (
          <EmptyValue />
        ),
    },
    {
      id: "reserve",
      header: "Reserve",
      width: "112px",
      numeric: true,
      hideBelow: "xl",
      mobile: "hidden",
      cell: (row) => <StaffMoney minor={row.reserve} />,
    },
    {
      id: "current",
      header: "Current bid",
      width: "120px",
      numeric: true,
      sortable: true,
      defaultSortDirection: "desc",
      sortValue: (row) => row.current,
      mobile: "meta",
      cell: (row) =>
        row.unsold ? (
          <span className="text-staff-muted">Unsold</span>
        ) : (
          <StaffMoney minor={row.current} />
        ),
    },
    {
      id: "closes",
      header: "Closes",
      width: "172px",
      sortable: true,
      defaultSortDirection: "asc",
      sortValue: (row) => row.endsAt.getTime(),
      hideBelow: "md",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.endsAt} withTime />,
    },
    rowActionsColumn<SaleLotRow>({
      label: (row) => `Actions for lot ${row.title}`,
      actions: (row) => {
        const lot = row.lot;
        return [
          { id: "open", label: "Open lot page", href: `/admin/lots/${lot.id}` },
          ...(lot.artistId && artistNameById[lot.artistId]
            ? [
                {
                  id: "artist",
                  label: `Open artist ${artistNameById[lot.artistId]}`,
                  href: `/admin/artists/${lot.artistId}`,
                },
              ]
            : []),
          ...(canManageAuction
            ? [{ id: "edit", label: "Edit lot", href: `/admin/lots/${lot.id}/edit` }]
            : []),
          ...(canEditDraft && canManageAuction
            ? [
                {
                  id: "detach",
                  label: "Remove from sale…",
                  onSelect: () => detach(lot),
                },
              ]
            : []),
          ...(canManageAuction && lot.status === "active"
            ? [
                {
                  id: "end",
                  label: "End lot…",
                  tone: "danger" as const,
                  onSelect: () => endLot(lot),
                },
              ]
            : []),
          ...lotActions.actionsFor({
            id: lot.id,
            title: lot.title,
            status: lot.status,
            inDraftSale: canEditDraft,
            canDelete: false,
            hasWinner: Boolean(lot.winnerId),
            withdrawalRequested: false,
          }),
        ];
      },
    }),
  ];

  const addAction = canEditDraft ? (
    <Link
      href={saleSetupHref(saleId, "lots")}
      className={staffButtonVariants({ variant: "primary", size: "sm" })}
    >
      <Plus aria-hidden />
      Add lot
    </Link>
  ) : canAddLots ? (
    <StaffButton
      variant="secondary"
      size="sm"
      icon={<Plus aria-hidden />}
      onClick={() => setAddOpen(true)}
    >
      Add lot
    </StaffButton>
  ) : null;

  const empty = canEditDraft
    ? {
        title: "No lots in this sale yet",
        description:
          "Add new lots in the sale setup, or attach lots that are already in inventory. They appear here with their estimates and bids.",
        action: addAction,
      }
    : canAddLots
      ? {
          title: "No lots in this sale yet",
          description:
            "Add a lot and it is scheduled as soon as it is saved. Lots appear here with their estimates and bids.",
          action: addAction,
        }
      : {
          title: "This sale has no lots",
          description: "No lots were added before the sale closed.",
        };

  const attachAction = canEditDraft ? (
    <StaffButton variant="secondary" size="sm" onClick={() => setAttachOpen(true)}>
      Attach existing lot
    </StaffButton>
  ) : null;

  // With lots, the secondary actions sit beside the table's search and wrap with it on a phone,
  // so the header keeps one action. With none there is nothing to print or export: the header
  // holds "Attach existing lot" and "Add lot".
  const toolbarActions = (
    <>
      {canManageAuction ? (
        <AdminSaleLotQrPrintButton
          lots={lots.map((lot) => ({
            id: lot.id,
            title: lot.title,
            lotNumber: lot.lotNumber,
          }))}
        />
      ) : null}
      <ExportButton
        entityType="lots"
        filters={{ saleId }}
        className={staffButtonVariants({ variant: "secondary", size: "sm" })}
      />
      {attachAction}
      {sale.status === "cancelled" && returnEligible.length > 0 && canManageAuction ? (
        <StaffButton variant="secondary" size="sm" onClick={returnAll}>
          Return lots to inventory
        </StaffButton>
      ) : null}
    </>
  );

  const filtered = rows.length !== lots.length;

  return (
    <>
      <RelatedRecordsSection<SaleLotRow>
        id="sale-lots"
        title="Lots"
        label="Lots in this sale"
        action={
          lots.length > 0 ? (
            addAction
          ) : (
            <>
              {attachAction}
              {addAction}
            </>
          )
        }
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        defaultSort={{ columnId: "number", direction: "asc" }}
        density="comfortable"
        empty={
          search.trim() || lens !== "all"
            ? {
                title: "No lots match",
                description: "Try another filter, or clear the search.",
              }
            : empty
        }
        toolbar={
          lots.length > 0 ? (
            <DataTableToolbar
              search={
                <TableSearch
                  live
                  label="Search lots"
                  placeholder="Search by title or lot number"
                  value={search}
                  onSearch={setSearch}
                />
              }
              end={toolbarActions}
              filters={
                <SegmentedControl<SaleLotsLens>
                  label="Filter lots"
                  value={lens}
                  onValueChange={setLens}
                  options={filters.map((filter) => ({
                    value: filter.id as SaleLotsLens,
                    label: filter.label,
                  }))}
                />
              }
            />
          ) : undefined
        }
        footer={filtered ? `Showing ${rows.length} of ${lots.length} lots` : undefined}
      />
      {canEditDraft ? (
        <AttachExistingLotDialog
          open={attachOpen}
          onOpenChange={setAttachOpen}
          saleId={saleId}
          saleWindow={{
            deliveryMode: sale.deliveryMode,
            startTime: sale.startTime,
            endTime: sale.endTime,
          }}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          categories={categories}
          onAttached={() => router.refresh()}
        />
      ) : null}
      {canAddLots && !canEditDraft ? (
        <EmergencyAddLotDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          saleId={saleId}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          saleStartTime={sale.startTime}
          saleEndTime={sale.endTime}
          categories={categories}
          englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
          onAdded={() => router.refresh()}
        />
      ) : null}
      {lotActions.dialogs}
      {confirm.dialog}
    </>
  );
}
