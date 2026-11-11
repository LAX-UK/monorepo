"use client";

import { artworkSectionLine } from "@/lib/admin/private-sales/deal-artwork.vm";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import {
  type KeyValueItem,
  RecordThumbnail,
  StaffButton,
  TextLink,
  WhereItIsSection,
} from "@auction/staff-ui";
import { ArrowLeftRight, Link2, Lock } from "lucide-react";

type Props = {
  deal: DealRecord;
  onLink: () => void;
  onChange: () => void;
  onRemove: () => void;
};

/** The artwork's picture and name, so staff see which piece the deal is for before reading where it is. */
function Subject({ artwork }: { artwork: NonNullable<DealRecord["artwork"]> }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3">
      <RecordThumbnail src={artwork.thumbnailUrl} title={artwork.title} className="size-12" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-staff-sm font-semibold text-staff-fg">{artwork.title}</span>
        <span className="truncate text-staff-xs text-staff-muted">
          {artwork.artist} · {artwork.stockCode}
        </span>
      </span>
    </div>
  );
}

function facts(artwork: NonNullable<DealRecord["artwork"]>): KeyValueItem[] {
  return [
    { label: "Original or print", value: "Original" },
    ...(artwork.catalogueStatus ? [{ label: "Zoho status", value: artwork.catalogueStatus }] : []),
    ...(artwork.recordHref
      ? [
          {
            label: "In Zoho",
            value: (
              <TextLink href={artwork.recordHref} external>
                From Zoho record
              </TextLink>
            ),
          },
        ]
      : []),
  ];
}

/**
 * The deal's artwork, in the same "Where it is" block as the lot page and the From Zoho record.
 * What a person can do comes from the record (`artworkAccess`), decided by the desk from their
 * role and the deal's stage; a person who cannot change it sees the section and nothing to press.
 */
export function DealArtworkSection({ deal, onLink, onChange, onRemove }: Props) {
  const { artwork, artworkAccess: access } = deal;
  const line = artworkSectionLine(deal);
  const actions =
    access.canLink || access.canChange || access.changeOffReason ? (
      <>
        {access.canLink ? (
          <StaffButton
            size="sm"
            variant={deal.artworkUnlinkedReason === "sellers_own_work" ? "secondary" : "primary"}
            icon={<Link2 aria-hidden />}
            onClick={onLink}
          >
            Link artwork…
          </StaffButton>
        ) : null}
        {access.canChange ? (
          <>
            <StaffButton
              size="sm"
              variant="secondary"
              icon={<ArrowLeftRight aria-hidden />}
              onClick={onChange}
            >
              Change artwork…
            </StaffButton>
            <StaffButton size="sm" variant="ghost" onClick={onRemove}>
              Remove artwork…
            </StaffButton>
          </>
        ) : null}
        {access.changeOffReason ? (
          <p className="m-0 flex basis-full items-start gap-1.5 text-staff-xs text-staff-muted">
            <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>{access.changeOffReason}</span>
          </p>
        ) : null}
      </>
    ) : undefined;
  return (
    <WhereItIsSection
      title="Artwork"
      chip={line.chip}
      {...(artwork ? { subject: <Subject artwork={artwork} /> } : {})}
      lead={line.lead}
      {...(line.trail ? { trail: line.trail } : {})}
      note={line.note}
      {...(actions ? { actions } : {})}
      {...(artwork ? { facts: facts(artwork) } : {})}
    />
  );
}
