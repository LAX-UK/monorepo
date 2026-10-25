"use client";

import { adminCreateArtistResultAction } from "@/lib/actions/admin";
import { ARTIST_KIND_OPTIONS, artistKindMeta } from "@/lib/artists/kind-presenter";
import { notify } from "@/lib/ui/notify";
import { EnumSelect, Field, Notice, StaffButton, StaffDialog, TextInput } from "@auction/staff-ui";
import type { ArtistKind } from "@auction/types";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

const FORM_ID = "create-artist-profile";

const KIND_OPTIONS = ARTIST_KIND_OPTIONS.map((option) => ({
  ...option,
  description: artistKindMeta(option.value).description,
}));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The account the new profile is linked to. */
  userId: string;
  userName: string;
};

/**
 * Creates an artist profile linked to this client's account, then opens it to complete. A failure
 * stays in the dialog with what was typed; Cancel has the first focus.
 */
export function CreateArtistProfileDialog({ open, onOpenChange, userId, userName }: Props) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(userName);
  const [kind, setKind] = useState<ArtistKind>("artist");
  const [nameError, setNameError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const submit = () => {
    const displayName = name.trim();
    if (!displayName) {
      setNameError("Enter the profile's name.");
      return;
    }
    setNameError(null);
    setFailure(null);
    startTransition(async () => {
      const result = await adminCreateArtistResultAction({
        displayName,
        kind,
        ownerUserId: userId,
      });
      if (result.ok) {
        onOpenChange(false);
        notify.success(`Artist profile created for ${displayName}`);
        if (result.data?.id)
          router.push(`/admin/artists/${encodeURIComponent(result.data.id)}/edit`);
        else router.refresh();
        return;
      }
      const fieldMessage = result.fieldErrors?.displayName?.[0];
      if (fieldMessage) setNameError(fieldMessage);
      else setFailure(result.error);
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={`Create an artist profile for ${userName}`}
      description="The profile is linked to this account as its maker or owner. It does not give them access to edit it."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={busy}>
            Create profile
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        <Field label="Name" error={nameError} disabled={busy}>
          <TextInput
            value={name}
            maxLength={200}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(null);
            }}
          />
        </Field>
        <Field label="Type" disabled={busy}>
          <EnumSelect<ArtistKind> value={kind} onValueChange={setKind} options={KIND_OPTIONS} />
        </Field>
      </form>
    </StaffDialog>
  );
}
