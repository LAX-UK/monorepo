"use client";

import { type ArtistsStaffRow, lotCountLabel } from "@/lib/admin/artists/artists-staff-list.vm";
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
 * An artist beside the list: kind and years, lots, aliases and owner, with the artist page, the
 * editor and the same actions as the row's `…` menu. Built from the row, so it opens at once.
 */
export function ArtistQuickView({
  row,
  canWrite,
  onClose,
  actions,
}: {
  row: ArtistsStaffRow | null;
  canWrite: boolean;
  onClose: () => void;
  actions: readonly OverflowAction[];
}) {
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={row?.name ?? "Artist"}
      status={
        row ? (
          <>
            {row.status ? (
              <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
            ) : null}
            {row.flags.map((flag) => (
              <StatusBadge key={flag.label} tone={flag.tone}>
                {flag.label}
              </StatusBadge>
            ))}
          </>
        ) : null
      }
      meta={
        row
          ? [
              ...(row.kind ? [{ label: "Kind", value: row.kind }] : []),
              ...(row.lifespan ? [{ label: "Years", value: row.lifespan }] : []),
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
          <OverflowMenu label="Artist actions" actions={actions} Link={Link} />
        ) : null
      }
      summary={
        row
          ? [
              { label: "Lots", value: lotCountLabel(row.lots) },
              {
                label: "Aliases",
                value: row.aliases === 0 ? null : String(row.aliases),
                numeric: true,
              },
              { label: "Owner account", value: row.owner },
              { label: "Updated", value: <StaffDate value={row.updatedAt} /> },
              { label: "Artist ID", value: row.id, copyValue: row.id },
            ]
          : []
      }
      footer={
        row && canWrite ? (
          <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />}>
            <Link href={row.editHref}>Edit artist</Link>
          </StaffButton>
        ) : null
      }
    >
      {row?.portraitUrl ? (
        <PanelSection title="Portrait">
          <RecordImage src={row.portraitUrl} alt={row.name} />
        </PanelSection>
      ) : null}
    </DetailPanel>
  );
}
