"use client";

import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { artistOption, searchArtistOptions } from "@/lib/admin/pickers/staff-entity-search";
import { notify } from "@/lib/ui/notify";
import { EntityPicker, Field, FormSection, Notice } from "@auction/staff-ui";
import type { ArtistProfile } from "@auction/types";
import { useState, useTransition } from "react";

/**
 * Who the lot is catalogued under. Saved as soon as it is chosen, through the lot itself rather
 * than the catalogue copy, so it sits apart from the form's Save.
 */
export function ArtistAttributionPanel({
  lotId,
  artists,
  artistId,
  onSaved,
}: {
  lotId: string;
  artists: ArtistProfile[];
  artistId: string | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<string | null>(artistId);
  const [failure, setFailure] = useState<string | null>(null);
  const known = artists.find((artist) => artist.id === value);
  const [selected, setSelected] = useState(known ? artistOption(known) : null);

  return (
    <FormSection
      title="Attribution"
      description="Saved as soon as it changes. It drives the public artist page and the other works by this maker."
    >
      {failure ? (
        <Notice tone="danger" alert title="The artist was not changed">
          {failure}
        </Notice>
      ) : null}
      <Field label="Artist, maker or brand" optional description={pending ? "Saving…" : undefined}>
        <EntityPicker
          value={value}
          selected={selected}
          search={searchArtistOptions}
          placeholder="Not attributed"
          searchPlaceholder="Type at least two letters"
          emptyText="No artists match. Add the artist from Artists first."
          disabled={pending}
          onValueChange={(option) => {
            const previous = { value, selected };
            setValue(option?.id ?? null);
            setSelected(option);
            setFailure(null);
            startTransition(async () => {
              const result = await adminUpdateLotResultAction(lotId, {
                artistId: option?.id ?? null,
              });
              if (result.ok) {
                notify.success(option ? `Attributed to ${option.label}` : "Attribution removed");
                onSaved();
                return;
              }
              setValue(previous.value);
              setSelected(previous.selected);
              setFailure(result.error);
            });
          }}
        />
      </Field>
    </FormSection>
  );
}
