"use client";

import type { LotsStaffRow } from "@/lib/admin/lots/lots-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  RecordImage,
  StaffButton,
  StaffDate,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

/**
 * A lot beside the list: its photo, sale, money and timing, the seller's withdrawal request when
 * there is one, and the same actions as the row's `…` menu. Built from the row the list already
 * loaded, so it opens at once.
 */
export function LotQuickView({
  row,
  canManageCatalog,
  onClose,
  actions,
}: {
  row: LotsStaffRow | null;
  canManageCatalog: boolean;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Lot"}
      status={
        row ? (
          <StatusBadge tone={row.status.tone} live={row.status.live ?? false}>
            {row.status.label}
          </StatusBadge>
        ) : null
      }
      meta={
        row
          ? [
              ...(row.lotNumber != null ? [{ label: "Lot", value: String(row.lotNumber) }] : []),
              ...(row.artist ? [{ label: "Artist", value: row.artist }] : []),
              { label: "Type", value: row.auctionType },
            ]
          : []
      }
      headerActions={
        row ? (
          <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
            <Link href={row.href}>Open full page</Link>
          </StaffButton>
        ) : null
      }
      overflow={
        actions.length > 0 ? (
          <OverflowMenu label="Lot actions" actions={actions} Link={Link} />
        ) : null
      }
      notice={
        row?.withdrawalRequestedAt ? (
          <Notice tone="warning" title="The seller has asked to withdraw this lot">
            Asked {formatStaffDateTime(row.withdrawalRequestedAt, { zoneLabel: true })}. Approve or
            decline the request from the lot's actions.
          </Notice>
        ) : null
      }
      summary={
        row
          ? [
              {
                label: "Sale",
                value:
                  row.saleHref && row.saleTitle ? (
                    <CellLink href={row.saleHref} Link={Link}>
                      {row.saleTitle}
                    </CellLink>
                  ) : null,
              },
              { label: "Estimate", value: row.estimate, numeric: true },
              {
                label: row.hammer ? "Hammer" : "Opening bid",
                value: row.hammer ?? row.startingFrom?.replace(/^From /, "") ?? null,
                numeric: true,
              },
              { label: "Ends", value: <StaffDate value={row.endsAt} withTime /> },
              {
                label: "Photos",
                value: row.photos === 0 ? "None yet" : String(row.photos),
                numeric: row.photos > 0,
              },
              { label: "Added", value: <StaffDate value={row.addedAt} /> },
              { label: "Lot ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && canManageCatalog ? (
          <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
            <Link href={row.editHref}>Edit lot</Link>
          </StaffButton>
        ) : null
      }
    >
      {row?.thumbnailUrl ? (
        <PanelSection title="Photo">
          <RecordImage src={row.thumbnailUrl} alt={row.title} />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
