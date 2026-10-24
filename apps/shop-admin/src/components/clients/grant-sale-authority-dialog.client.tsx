"use client";

import { ArtworkPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { searchArtworkOptions } from "@/server/application/admin-lookup-actions.server";
import { grantArtworkSaleAuthority } from "@/server/application/admin-people-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import {
  AUTHORISED_COUNT_OPTIONS,
  checkGrantAuthority,
  grantButtonLabel,
} from "@/server/domain/sale-authority.vm";
import { SALE_AUTHORITY_NOTE_MAX_LENGTH } from "@auction/shop-contracts";
import { EnumSelect, Field, TextArea } from "@auction/staff-ui";
import { useCallback, useState } from "react";

/**
 * Authorise a person to sell editions of an artwork. The owner starts as the client whose page
 * this is, and both owner and artwork are chosen by name; an empty artwork search lists the works
 * the client already holds. The grant is audited with the evidence note, and needs a recent
 * sign-in, which the dialog offers if it is missing.
 */
export function GrantSaleAuthorityDialog({
  open,
  onOpenChange,
  client,
  ownedArtworks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client whose page this is; the owner starts as them. */
  client: LookupOption;
  /** Artworks the client already holds editions of, offered before anything is typed. */
  ownedArtworks: LookupOption[];
}) {
  const mutation = useAdminMutation();
  const [owner, setOwner] = useState<LookupOption | null>(client);
  const [artwork, setArtwork] = useState<LookupOption | null>(null);
  const [count, setCount] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [submits, setSubmits] = useState(0);

  const searchArtworks = useCallback(
    (query: string) =>
      query.trim() || ownedArtworks.length === 0
        ? searchArtworkOptions(query)
        : Promise.resolve(ownedArtworks),
    [ownedArtworks],
  );

  const checked = checkGrantAuthority({ owner, artwork, count, evidenceNote });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};

  const submit = async () => {
    setSubmits((value) => value + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => grantArtworkSaleAuthority({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `Sale authority for ${artwork?.label ?? "the artwork"} granted to ${owner?.label ?? "the owner"}`,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <StaffFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Grant sale authority"
      description="Lets this person sell editions of an artwork. The grant is recorded with your evidence note."
      submitLabel={grantButtonLabel(count === null ? null : Number(count))}
      pending={mutation.pending}
      onSubmit={() => void submit()}
    >
      <StaffMutationError mutation={mutation} />
      <Field label="Owner" error={errors.owner}>
        <PartyPicker value={owner} onChange={setOwner} />
      </Field>
      <Field label="Artwork" error={errors.artwork}>
        <ArtworkPicker value={artwork} onChange={setArtwork} search={searchArtworks} />
      </Field>
      <Field label="Editions they may sell" error={errors.count}>
        <EnumSelect
          value={count}
          onValueChange={setCount}
          options={AUTHORISED_COUNT_OPTIONS}
          placeholder="Choose how many"
        />
      </Field>
      <Field
        label="Evidence note"
        description="What the authority is based on, such as a signed agreement."
        error={errors.evidenceNote}
      >
        <TextArea
          rows={3}
          maxLength={SALE_AUTHORITY_NOTE_MAX_LENGTH}
          value={evidenceNote}
          onChange={(event) => setEvidenceNote(event.target.value)}
        />
      </Field>
    </StaffFormDialog>
  );
}
