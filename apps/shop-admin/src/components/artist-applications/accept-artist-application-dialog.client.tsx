"use client";

import { ARTIST_SLUG_PATTERN, suggestArtistSlug } from "@/server/domain/artist-application.vm";
import {
  ChoiceRow,
  Field,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  TextInput,
} from "@auction/staff-ui";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { ArtistApplicationTarget } from "./use-artist-application-actions.client";

export type AcceptChoices = { artistSlug: string; importWorksAsDrafts: boolean };

function slugError(slug: string): string | undefined {
  if (!slug.trim()) return "Enter the profile address.";
  if (!ARTIST_SLUG_PATTERN.test(slug.trim()) || slug.length > 120) {
    return "Use lower-case letters, numbers and single hyphens, like ada-moreno.";
  }
  return undefined;
}

/**
 * Accepting is the one wide, irreversible step in a review: it makes a public artist profile,
 * opens the artist portal and emails the artist. The dialog says all three, asks for the profile
 * address (suggested from the artist's name), and leaves importing the works unticked, because
 * that choice adds records staff then have to look after.
 */
export function AcceptArtistApplicationDialog({
  open,
  onOpenChange,
  target,
  loading,
  error,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ArtistApplicationTarget;
  loading: boolean;
  /** The API's refusal, such as an address already in use. */
  error: string | null;
  onAccept: (choices: AcceptChoices) => void;
}) {
  const [slug, setSlug] = useState(() => suggestArtistSlug(target.artistName));
  const [importWorks, setImportWorks] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const importId = useId();
  const formId = useId();

  useEffect(() => {
    if (!open) return;
    setSlug(suggestArtistSlug(target.artistName));
    setImportWorks(false);
    setFieldError(undefined);
  }, [open, target.artistName]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = slugError(slug);
    setFieldError(found);
    if (found) return;
    onAccept({ artistSlug: slug.trim(), importWorksAsDrafts: importWorks });
  };

  const works = target.workCount;
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={`Accept ${target.title}?`}
      description="This makes them a gallery artist: it creates their artist profile, opens the artist portal to the LAX Account they applied with, and emails them a welcome. It cannot be undone from here."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={formId} variant="primary" loading={loading}>
            Accept and send welcome
          </StaffButton>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        {error ? (
          <Notice tone="danger" alert title="Not accepted">
            {error}
          </Notice>
        ) : null}
        <Field
          label="Profile address"
          description="Where the artist's page will live on lax.art. Lower-case words joined by hyphens."
          error={fieldError}
          disabled={loading}
        >
          <TextInput
            value={slug}
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            leading={<span className="text-staff-sm text-staff-muted">lax.art/artists/</span>}
            onChange={(event) => {
              setSlug(event.target.value);
              if (fieldError) setFieldError(slugError(event.target.value));
            }}
          />
        </Field>
        {works > 0 ? (
          <ChoiceRow
            htmlFor={importId}
            disabled={loading}
            control={
              <StaffCheckbox
                id={importId}
                checked={importWorks}
                disabled={loading}
                onCheckedChange={(checked) => setImportWorks(checked === true)}
              />
            }
            label={`Add the ${works} ${works === 1 ? "work" : "works"} as draft artworks`}
            description="Drafts are not public. Set prices and publish each one when it is ready."
          />
        ) : null}
      </form>
    </StaffDialog>
  );
}
