"use client";

import { ArtistFlagCheckbox } from "../fields";
import type { ArtistFormSectionProps } from "../types";

export function FlagsSection({ control, disabled = false }: ArtistFormSectionProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ArtistFlagCheckbox name="featured" control={control} disabled={disabled} />
      <ArtistFlagCheckbox name="verified" control={control} disabled={disabled} />
      <ArtistFlagCheckbox name="archived" control={control} disabled={disabled} />
    </div>
  );
}
