"use client";

import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function MediaSection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ArtistTextField
        control={control}
        name="portraitUrl"
        label="Portrait URL"
        disabled={disabled}
      />
      <ArtistTextField
        control={control}
        name="heroImageUrl"
        label="Hero image URL"
        disabled={disabled}
      />
      <ArtistTextField
        control={control}
        name="websiteUrl"
        label="Website URL"
        disabled={disabled}
      />
    </div>
  );
}
