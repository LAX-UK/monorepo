"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type ArtistFormField,
  EMPTY_ARTIST_FORM,
  artistConflictField,
  buildArtistCreateBody,
  validateArtistForm,
  withArtistName,
} from "@/lib/artist-form";
import { createArtist } from "@/server/application/admin-artwork-actions.server";
import { Field, Notice, StaffButton, StaffDialog, TextInput, toast } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Adds an artist with a name, a web address and an optional discipline; the rest (biography,
 * sign-in link, search listing) is filled in on the artist's page, where this opens next.
 */
export function ArtistCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_ARTIST_FORM);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<ArtistFormField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const errors = { ...serverErrors, ...(attempted ? validateArtistForm(values) : {}) };

  function close(next: boolean) {
    if (!next && !saving) {
      setValues(EMPTY_ARTIST_FORM);
      setAttempted(false);
      setServerErrors({});
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    setAttempted(true);
    if (Object.keys(validateArtistForm(values)).length > 0) return;
    setSaving(true);
    setFormError(null);
    const result = await createArtist({
      body: buildArtistCreateBody(values),
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      const field = result.kind === "conflict" ? artistConflictField(result.message) : null;
      if (result.kind === "conflict" && field) setServerErrors({ [field]: result.message });
      else setFormError(adminMutationErrorMessage(result));
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    toast.success(`Added ${values.displayName.trim()}`);
    close(false);
    router.push(`/artists/${result.data.artistId}`);
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={close}
      size="md"
      title="New artist"
      description="Add the artist now; fill in their biography and search listing on their page."
      footer={
        <>
          <StaffButton variant="secondary" onClick={() => close(false)} disabled={saving}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" type="submit" form="artist-create-form" loading={saving}>
            Add artist
          </StaffButton>
        </>
      }
    >
      <form
        id="artist-create-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        <Field label="Name" error={errors.displayName}>
          <TextInput
            autoFocus
            autoComplete="off"
            value={values.displayName}
            onChange={(event) => {
              setValues(withArtistName(values, event.target.value));
              setServerErrors({});
            }}
          />
        </Field>
        <Field
          label="Web address"
          description="Lower case words joined by hyphens, such as ada-lovelace."
          error={errors.slug}
        >
          <TextInput
            autoComplete="off"
            spellCheck={false}
            leading={<span className="text-staff-muted">/artists/</span>}
            value={values.slug}
            onChange={(event) => {
              setValues({ ...values, slug: event.target.value, slugEdited: true });
              setServerErrors({});
            }}
          />
        </Field>
        <Field label="Discipline" optional error={errors.discipline}>
          <TextInput
            placeholder="Painter"
            value={values.discipline}
            onChange={(event) => setValues({ ...values, discipline: event.target.value })}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
