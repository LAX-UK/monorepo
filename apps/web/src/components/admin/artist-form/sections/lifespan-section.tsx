"use client";

import { type ArtistKind, isOrganisationKind } from "@auction/types";
import { ArtistTextField } from "../fields";
import type { ArtistFormSectionProps } from "../types";

/** Lifespan labels depend on the kind: organisations use founded/dissolved,
 * people use birth/death. Driven by the shared creator-kind config (OCP). */
export function LifespanSection({
  control,
  kind = "artist",
  disabled = false,
}: ArtistFormSectionProps & { kind?: ArtistKind }) {
  const org = isOrganisationKind(kind);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {org ? (
          <>
            <ArtistTextField
              control={control}
              name="foundedYear"
              label="Founded year"
              disabled={disabled}
            />
            <ArtistTextField
              control={control}
              name="dissolvedYear"
              label="Dissolved year"
              disabled={disabled}
            />
          </>
        ) : (
          <>
            <ArtistTextField
              control={control}
              name="birthYear"
              label="Birth year"
              disabled={disabled}
            />
            <ArtistTextField
              control={control}
              name="deathYear"
              label="Death year"
              disabled={disabled}
            />
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ArtistTextField
          control={control}
          name="countryCode"
          label={org ? "Country of origin (ISO code)" : "Country (ISO code)"}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
