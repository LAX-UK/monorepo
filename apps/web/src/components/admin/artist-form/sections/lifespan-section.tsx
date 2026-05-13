"use client";

import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function LifespanSection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ArtistTextField control={control} name="birthYear" label="Birth year" disabled={disabled} />
      <ArtistTextField control={control} name="deathYear" label="Death year" disabled={disabled} />
    </div>
  );
}
