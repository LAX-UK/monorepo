"use client";

import { MediaImage } from "@/components/ui/media-image";
import { moveEntry } from "@/lib/admin/sale-cover/cover-draft";
import { type CoverLotOption, lotLabel } from "@/lib/admin/sale-cover/cover-view";
import { EnumSelect, Section, SortableList } from "@auction/staff-ui";
import { SALE_FEATURED_LOTS_MAX } from "@auction/types";
import { useMemo } from "react";

type Props = {
  lots: readonly CoverLotOption[];
  featuredLotIds: readonly string[];
  /** The lot the default cover is a detail of, if any. */
  coverLotId: string | null;
  canEdit: boolean;
  onChange: (lotIds: string[]) => void;
};

type Row = { id: string; lot: CoverLotOption | null };

/**
 * The lots the home page leads with, in order: the hero's plate and the hang read this list.
 * Reorder by dragging the handle or with the keyboard; add from the lots in this sale.
 */
export function FeaturedLotsEditor({ lots, featuredLotIds, coverLotId, canEdit, onChange }: Props) {
  const byId = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
  const rows = useMemo<Row[]>(
    () => featuredLotIds.map((id) => ({ id, lot: byId.get(id) ?? null })),
    [featuredLotIds, byId],
  );
  const addable = lots.filter((lot) => !featuredLotIds.includes(lot.id));
  const full = featuredLotIds.length >= SALE_FEATURED_LOTS_MAX;

  return (
    <Section
      title="Featured lots"
      description="Order used by the hero's plate and the hang."
      action={
        <span className="text-staff-sm text-staff-muted tabular-nums">
          {featuredLotIds.length} of {SALE_FEATURED_LOTS_MAX}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-staff-sm text-staff-muted">
            No lots are featured, so the home page leads with this sale's first lots. Add the works
            you want to show first.
          </p>
        ) : (
          <SortableList
            label="Featured lots"
            items={rows}
            getKey={(row) => row.id}
            itemName={(row) => (row.lot ? lotLabel(row.lot) : "A lot no longer in this sale")}
            {...(canEdit
              ? {
                  onMove: (from: number, to: number) =>
                    onChange(moveEntry(featuredLotIds, from, to)),
                  onRemove: (index: number) =>
                    onChange(featuredLotIds.filter((_, i) => i !== index)),
                }
              : {})}
            invalid={(row) => row.lot === null}
            renderItem={(row) => <FeaturedLotRow row={row} isCover={row.id === coverLotId} />}
          />
        )}
        {canEdit ? (
          <div className="max-w-[420px]">
            <EnumSelect
              aria-label="Add a lot"
              value={null}
              placeholder={
                full
                  ? `${SALE_FEATURED_LOTS_MAX} is the most. Remove one to add another.`
                  : addable.length === 0
                    ? "Every lot in this sale is featured"
                    : "Add a lot"
              }
              disabled={full || addable.length === 0}
              onValueChange={(lotId) => onChange([...featuredLotIds, lotId])}
              options={addable.map((lot) => ({ value: lot.id, label: lotLabel(lot) }))}
            />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function FeaturedLotRow({ row, isCover }: { row: Row; isCover: boolean }) {
  if (!row.lot) {
    return (
      <div className="flex min-w-0 flex-col">
        <span className="text-staff-sm font-medium text-staff-danger-fg">
          This lot is no longer in the sale
        </span>
        <span className="text-staff-xs text-staff-muted">Remove it so the list can be saved.</span>
      </div>
    );
  }
  const photo = row.lot.images[0];
  const facts = [
    isCover ? "Cover lot" : null,
    row.lot.dimensions ? `size ${row.lot.dimensions}` : null,
  ]
    .filter((fact): fact is string => fact !== null)
    .join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="size-10 shrink-0 overflow-hidden rounded-staff-xs bg-staff-sunken">
        {photo ? (
          <MediaImage
            src={photo}
            alt=""
            label="Lot"
            imgClassName="size-full object-cover"
            sizes="40px"
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-staff-sm font-medium text-staff-fg">
          {lotLabel(row.lot)}
        </span>
        <span className="truncate text-staff-xs text-staff-muted">
          {facts || "No size recorded"}
        </span>
      </span>
    </div>
  );
}
