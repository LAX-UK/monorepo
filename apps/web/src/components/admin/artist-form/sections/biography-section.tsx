"use client";

import { ArtistTextareaField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function BiographySection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="space-y-4">
      <ArtistTextareaField
        control={control}
        name="shortBio"
        label="Short bio"
        rows={3}
        disabled={disabled}
      />
      <ArtistTextareaField
        control={control}
        name="longBio"
        label="Long bio"
        rows={6}
        disabled={disabled}
      />
      <ArtistTextareaField
        control={control}
        name="statement"
        label="Artist statement"
        rows={6}
        disabled={disabled}
      />
    </div>
  );
}
