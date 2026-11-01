"use client";

import { MediaImage } from "@/components/ui/media-image";
import { type CoverLotOption, lotLabel } from "@/lib/admin/sale-cover/cover-view";
import { EnumSelect, Field, StaffButton, StaffDialog } from "@auction/staff-ui";
import { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lots: readonly CoverLotOption[];
  /** The photograph chosen: which lot, which of its pictures and the storage key. */
  onChoose: (choice: { lotId: string; imageIndex: number; key: string }) => void;
  /** True while the chosen picture is being measured. */
  busy?: boolean;
};

/** Picks one photograph of one lot in this sale as the cover (or a detail of it). */
export function LotPhotoDialog({ open, onOpenChange, lots, onChoose, busy = false }: Props) {
  const withPhotos = useMemo(() => lots.filter((lot) => lot.images.length > 0), [lots]);
  const [lotId, setLotId] = useState<string | null>(null);
  const lot = withPhotos.find((candidate) => candidate.id === lotId) ?? withPhotos[0];

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Use a lot photo"
      description="Choose a work from this sale. You can zoom in to a detail afterwards."
      footer={
        <StaffButton variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </StaffButton>
      }
    >
      {withPhotos.length === 0 || !lot ? (
        <p className="text-staff-sm text-staff-muted">
          None of this sale's lots has a photograph yet. Add photographs to a lot, or upload a
          picture instead.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Lot">
            <EnumSelect
              value={lot.id}
              onValueChange={setLotId}
              options={withPhotos.map((candidate) => ({
                value: candidate.id,
                label: lotLabel(candidate),
              }))}
            />
          </Field>
          <ul className="grid list-none grid-cols-3 gap-3 p-0">
            {lot.images.map((key, index) => (
              // A lot can repeat a picture, so the position is part of its identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: photographs have no id of their own
              <li key={`${key}-${index}`}>
                <StaffButton
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Photo ${index + 1} of ${lotLabel(lot)}`}
                  onClick={() => onChoose({ lotId: lot.id, imageIndex: index, key })}
                  className="aspect-square h-auto w-full overflow-hidden rounded-staff-sm border border-staff-line bg-staff-sunken p-0 hover:border-staff-line-strong"
                >
                  <MediaImage
                    src={key}
                    alt=""
                    label={`Photo ${index + 1}`}
                    imgClassName="size-full object-cover"
                    sizes="160px"
                  />
                </StaffButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StaffDialog>
  );
}
