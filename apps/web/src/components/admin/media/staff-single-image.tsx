"use client";

import { StaffImageCollection } from "@/components/admin/media/staff-image-collection";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";

type Props = {
  kind: CatalogImageUploadKind;
  /** The stored image reference, or empty. */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** What the image is called, in lower case: "portrait", "hero image". */
  noun: string;
  disabled?: boolean;
  previewUrlByKey?: Record<string, string>;
};

/** One uploaded image on the kit: drop or browse to add it; remove it to upload another. */
export function StaffSingleImage({
  kind,
  value,
  onChange,
  noun,
  disabled = false,
  previewUrlByKey = {},
}: Props) {
  return (
    <StaffImageCollection
      kind={kind}
      value={value ? [{ key: value }] : []}
      onChange={(next) => onChange(next[0]?.key ?? null)}
      noun={noun}
      uploadLabel={`Upload ${noun}`}
      maxFiles={1}
      disabled={disabled}
      previewUrlByKey={previewUrlByKey}
    />
  );
}
