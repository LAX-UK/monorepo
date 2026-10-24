"use client";

import type { LotsStaffRow } from "@/lib/admin/lots/lots-staff-list.vm";
import {
  DetailPanel,
  KeyValueList,
  PanelSection,
  StaffButton,
  StatusBadge,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

/**
 * A lot beside the list: its image, sale, money and timing, with the lot page and the editor one
 * click away. Built from the row the list already loaded, so it opens instantly.
 */
export function LotQuickView({
  row,
  canManageCatalog,
  onClose,
}: {
  row: LotsStaffRow | null;
  canManageCatalog: boolean;
  onClose: () => void;
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.title ?? "Lot"}
      description={
        row
          ? [row.lotNumber != null ? `Lot ${row.lotNumber}` : null, row.artist]
              .filter(Boolean)
              .join(" · ") || undefined
          : undefined
      }
      status={
        row ? (
          <StatusBadge tone={row.status.tone} live={row.status.live ?? false}>
            {row.status.label}
          </StatusBadge>
        ) : null
      }
      footer={
        row ? (
          <>
            {canManageCatalog ? (
              <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
                <Link href={row.editHref}>Edit lot</Link>
              </StaffButton>
            ) : null}
            <StaffButton asChild variant="primary" icon={<ArrowUpRight aria-hidden />}>
              <Link href={row.href}>Open lot</Link>
            </StaffButton>
          </>
        ) : null
      }
    >
      {row ? (
        <>
          {row.thumbnailUrl ? (
            // A larger view of the catalogue image the row already shows.
            <img
              src={row.thumbnailUrl}
              alt={row.title}
              className="mb-6 aspect-[4/3] w-full rounded-staff-md border border-staff-line bg-staff-sunken object-contain"
            />
          ) : (
            <p className="mb-6 rounded-staff-md border border-dashed border-staff-line-strong px-4 py-6 text-center text-staff-sm text-staff-muted">
              No photos yet. Add them before publishing.
            </p>
          )}
          <PanelSection title="Lot">
            <KeyValueList
              items={[
                { label: "Sale", value: row.saleTitle ?? "Not in a sale" },
                { label: "Type", value: row.auctionType },
                { label: "Estimate", value: row.estimate, numeric: true },
                { label: "Hammer", value: row.hammer, numeric: true },
                { label: "Ends", value: formatStaffDateTime(row.endsAt) },
                { label: "Photos", value: String(row.photos), numeric: true },
                { label: "Lot ID", value: `${row.id.slice(0, 8)}…`, copyValue: row.id },
              ]}
            />
          </PanelSection>
        </>
      ) : null}
    </DetailPanel>
  );
}
