"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "@/lib/form-validation";
import { grantArtworkSaleAuthority } from "@/server/application/admin-people-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { SelectField, TextAreaField, TextField } from "../fields";

export function GrantSaleAuthorityForm({
  defaultOwnerPartyId,
  artworkOptions,
}: {
  defaultOwnerPartyId?: string;
  artworkOptions?: Array<{ artworkId: string; label: string }>;
}) {
  const mutation = useAdminMutation();
  const [artworkId, setArtworkId] = useState(artworkOptions?.[0]?.artworkId ?? "");
  const [ownerPartyId, setOwnerPartyId] = useState(defaultOwnerPartyId ?? "");
  const [authorisedCount, setAuthorisedCount] = useState("1");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Grant sale authority"
      mutation={mutation}
      errors={errors}
      submitLabel="Grant authority"
      onSubmit={() => {
        const count = parseWholeNumber(
          authorisedCount,
          { min: 0, max: 10 },
          "Authorised count must be a whole number from 0 to 10.",
        );
        const next = collectFieldErrors({
          artworkId: requiredText(artworkId, "Choose the artwork."),
          ownerPartyId: requiredText(ownerPartyId, "Enter the owner party ID."),
          authorisedCount: count.ok ? null : count.message,
          evidenceNote: requiredText(evidenceNote, "Enter an evidence note."),
        });
        setErrors(next);
        if (hasFieldErrors(next) || !count.ok) return;
        void mutation.run(
          () =>
            grantArtworkSaleAuthority({
              artworkId: artworkId.trim(),
              ownerPartyId: ownerPartyId.trim(),
              authorisedCount: count.value,
              evidenceNote: evidenceNote.trim(),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Sale authority granted",
        );
      }}
    >
      {artworkOptions?.length ? (
        <SelectField
          name="artworkId"
          label="Artwork"
          value={artworkId}
          options={artworkOptions.map((row) => ({ value: row.artworkId, label: row.label }))}
          error={errors.artworkId}
          disabled={mutation.pending}
          onChange={setArtworkId}
        />
      ) : (
        <TextField
          name="artworkId"
          label="Artwork ID"
          value={artworkId}
          error={errors.artworkId}
          disabled={mutation.pending}
          onChange={setArtworkId}
        />
      )}
      <TextField
        name="ownerPartyId"
        label="Owner party ID"
        value={ownerPartyId}
        error={errors.ownerPartyId}
        disabled={mutation.pending || Boolean(defaultOwnerPartyId)}
        onChange={setOwnerPartyId}
      />
      <TextField
        name="authorisedCount"
        label="Authorised count (0–10)"
        type="number"
        min={0}
        max={10}
        value={authorisedCount}
        error={errors.authorisedCount}
        disabled={mutation.pending}
        onChange={setAuthorisedCount}
      />
      <TextAreaField
        name="evidenceNote"
        label="Evidence note"
        rows={2}
        value={evidenceNote}
        error={errors.evidenceNote}
        disabled={mutation.pending}
        onChange={setEvidenceNote}
      />
    </AdminForm>
  );
}
