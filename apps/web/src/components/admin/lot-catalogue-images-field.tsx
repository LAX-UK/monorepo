"use client";

import { StaffImageCollection } from "@/components/admin/media/staff-image-collection";
import type { LotImageSaveEntry } from "@/lib/admin/lots/use-lot-images-save";

type Props = {
  value: LotImageSaveEntry[];
  onChange: (next: LotImageSaveEntry[]) => void;
  maxFiles?: number;
  disabled?: boolean;
};

/** A lot's catalogue photos with their alt text: the first is the main image in listings. */
export function LotCatalogueImagesField({
  value,
  onChange,
  maxFiles = 50,
  disabled = false,
}: Props) {
  return (
    <StaffImageCollection
      kind="lot_image"
      value={value}
      onChange={(next) => onChange(next.map((entry) => ({ key: entry.key, alt: entry.alt ?? "" })))}
      noun="photo"
      primaryLabel="Main"
      uploadLabel={value.length === 0 ? "Upload photos" : "Add photos"}
      maxFiles={maxFiles}
      disabled={disabled}
      withAlt
    />
  );
}
