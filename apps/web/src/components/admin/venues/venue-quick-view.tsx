"use client";

import { type VenuesStaffRow, capacityLabel } from "@/lib/admin/venues/venues-staff-list.vm";
import {
  CellLink,
  DetailPanel,
  type OverflowAction,
  OverflowMenu,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

/**
 * A venue beside the list: who owns it, where it is and how to reach it, with the venue page,
 * the editor and the same actions as the row's `…` menu. Built from the row, so it opens at once.
 */
export function VenueQuickView({
  row,
  onClose,
  actions,
}: {
  row: VenuesStaffRow | null;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.name ?? "Venue"}
      status={row ? <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge> : null}
      meta={
        row
          ? [
              {
                label: "Organisation",
                value: (
                  <CellLink href={row.organisationHref} Link={Link}>
                    {row.organisation}
                  </CellLink>
                ),
              },
              ...(row.slugLabel ? [{ label: "Slug", value: row.slugLabel }] : []),
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
          <OverflowMenu label="Venue actions" actions={actions} Link={Link} />
        ) : null
      }
      summary={
        row
          ? [
              { label: "Address", value: row.address },
              { label: "Capacity", value: capacityLabel(row.capacity) },
              { label: "Phone", value: row.phone },
              { label: "Email", value: row.email },
              { label: "Website", value: row.website },
              { label: "Updated", value: <StaffDate value={row.updatedAt} /> },
              { label: "Added", value: <StaffDate value={row.createdAt} /> },
              { label: "Venue ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row ? (
          <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
            <Link href={row.editHref}>Edit venue</Link>
          </StaffButton>
        ) : null
      }
    >
      {null}
    </DetailPanel>
  );
}
