"use client";

import type {
  ArtistApplicationFieldErrors,
  ArtistApplicationFormState,
} from "@/lib/artist-application/artist-application-form";
import { ARTIST_APPLICATION_LIMITS } from "@auction/shop-domain";
import { ApplicationTextArea } from "./application-fields";

type StatementFields = Pick<
  ArtistApplicationFormState,
  "statement" | "representation" | "exhibitions"
>;

/** Step 3: the artist statement, and where the work is shown today. */
export function ApplicationStatementStep({
  value,
  errors,
  onChange,
}: {
  value: StatementFields;
  errors: ArtistApplicationFieldErrors;
  onChange: (change: Partial<StatementFields>) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ApplicationTextArea
        field="statement"
        label="Artist statement"
        hint="What you make, how you work and what you are exploring now."
        rows={8}
        maxLength={ARTIST_APPLICATION_LIMITS.statement}
        value={value.statement}
        error={errors.statement}
        onChange={(event) => onChange({ statement: event.target.value })}
      />
      <ApplicationTextArea
        field="representation"
        label="Current representation"
        optional
        hint="Galleries or agents that show your work now, and where they are."
        rows={3}
        maxLength={ARTIST_APPLICATION_LIMITS.representation}
        value={value.representation}
        error={errors.representation}
        onChange={(event) => onChange({ representation: event.target.value })}
      />
      <ApplicationTextArea
        field="exhibitions"
        label="Exhibitions"
        optional
        hint="Recent shows, most recent first, with the venue and the year."
        rows={4}
        maxLength={ARTIST_APPLICATION_LIMITS.exhibitions}
        value={value.exhibitions}
        error={errors.exhibitions}
        onChange={(event) => onChange({ exhibitions: event.target.value })}
      />
    </div>
  );
}
