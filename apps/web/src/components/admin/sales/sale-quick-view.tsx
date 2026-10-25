"use client";

import { adminSaleSetupHref } from "@/lib/admin/catalog-route-helpers";
import { lotCountLabel } from "@/lib/admin/sales/sales-staff-list.vm";
import type { SalesStaffRow } from "@/lib/admin/sales/sales-staff-list.vm";
import {
  DetailPanel,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  RecordImage,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

/**
 * A sale beside the list: when it runs, how it is sold and how many lots it holds, with the sale
 * page, the editor and the same actions as the row's `…` menu. Built from the row, so it opens at
 * once.
 */
export function SaleQuickView({
  row,
  canManageSales,
  onClose,
  actions,
}: {
  row: SalesStaffRow | null;
  canManageSales: boolean;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Sale"}
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
              { label: "Type", value: row.delivery },
              { label: "Lots", value: lotCountLabel(row.lotCount) },
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
          <OverflowMenu label="Sale actions" actions={actions} Link={Link} />
        ) : null
      }
      summary={
        row
          ? [
              { label: "Starts", value: <StaffDate value={row.startsAt} withTime /> },
              { label: "Ends", value: <StaffDate value={row.endsAt} withTime /> },
              { label: "Added", value: <StaffDate value={row.addedAt} /> },
              { label: "Sale ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && canManageSales && row.statusCode === "draft" ? (
          <>
            <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
              <Link href={row.editHref ?? row.href}>Edit sale</Link>
            </StaffButton>
            <StaffButton asChild variant="primary">
              <Link href={adminSaleSetupHref(row.id)}>Continue setup</Link>
            </StaffButton>
          </>
        ) : row && canManageSales && row.editHref ? (
          <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
            <Link href={row.editHref}>Edit sale</Link>
          </StaffButton>
        ) : null
      }
    >
      {row?.coverImageUrl ? (
        <PanelSection title="Cover">
          <RecordImage src={row.coverImageUrl} alt={row.title} />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
