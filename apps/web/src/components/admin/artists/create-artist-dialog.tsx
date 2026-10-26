"use client";

import { adminCreateArtistResultAction } from "@/lib/actions/admin";
import { ARTIST_KIND_OPTIONS } from "@/lib/artists/kind-presenter";
import { checkArtistNameAvailability } from "@/lib/data/http/artist-search.client";
import {
  EnumSelect,
  Field,
  FieldRow,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import type { ArtistKind } from "@auction/types";
import { useEffect, useId, useState, useTransition } from "react";

export type CreatedArtist = {
  id: string;
  displayName: string;
  status: "pending" | "approved" | "rejected" | "merged_into";
};

type Props = {
  open: boolean;
  initialName: string;
  onCreated: (artist: CreatedArtist) => void;
  onCancel: () => void;
  /** Pre-fills the kind when the caller already knows it. */
  defaultKind?: ArtistKind | undefined;
  /** Links the new profile to this account (the seller who made the work); not editable here. */
  ownerUserId?: string | null;
  /** Creates an approved profile straight away (the submission decision flow). */
  approveOnCreate?: boolean;
};

/**
 * A quick way to add the catalogue artist a submission needs, without leaving the decision: the
 * name (checked against existing web addresses as it is typed), the kind and a few facts. The
 * full profile can be completed later from the artist's page.
 */
export function CreateArtistDialog({
  open,
  initialName,
  onCreated,
  onCancel,
  defaultKind,
  ownerUserId,
  approveOnCreate = false,
}: Props) {
  const nameId = useId();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [displayName, setDisplayName] = useState(initialName);
  const [kind, setKind] = useState<ArtistKind>(defaultKind ?? "artist");
  const [shortBio, setShortBio] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [nameStatus, setNameStatus] = useState<{
    available: boolean;
    suggestions: string[];
  } | null>(null);

  useEffect(() => {
    if (open) setDisplayName(initialName);
  }, [initialName, open]);

  useEffect(() => {
    if (!open) return;
    if (displayName.trim().length < 2) {
      setNameStatus(null);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const data = await checkArtistNameAvailability(displayName, controller.signal);
        if (data) setNameStatus(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [displayName, open]);

  const create = () => {
    setFailure(null);
    if (!displayName.trim()) {
      setNameError("Enter the artist's name");
      setAttempts((count) => count + 1);
      return;
    }
    setNameError(null);
    startTransition(async () => {
      const result = await adminCreateArtistResultAction({
        displayName: displayName.trim(),
        kind,
        ...(approveOnCreate ? { status: "approved" as const } : {}),
        ...(shortBio.trim() ? { shortBio: shortBio.trim() } : {}),
        ...(nationality.trim() ? { nationality: nationality.trim() } : {}),
        ...(birthYear.trim() ? { birthYear: birthYear.trim() } : {}),
        ...(deathYear.trim() ? { deathYear: deathYear.trim() } : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
      });
      if (!result.ok) {
        const fieldMessage =
          result.fieldErrors?.displayName?.[0] ??
          result.fieldErrors?.kind?.[0] ??
          result.fieldErrors?.shortBio?.[0];
        setFailure(fieldMessage ?? result.error);
        return;
      }
      const createdId = result.data?.id;
      if (!createdId) {
        setFailure(
          "The artist was created, but its page could not be found. Search for it by name.",
        );
        return;
      }
      onCreated({
        id: createdId,
        displayName: displayName.trim(),
        status: approveOnCreate ? "approved" : "pending",
      });
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
      size="md"
      title="Create artist"
      description="Add the profile now; complete it later from the artist's page."
      footer={
        <>
          <StaffButton variant="secondary" disabled={pending} onClick={onCancel}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={pending} onClick={create}>
            Create artist
          </StaffButton>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <FormErrorSummary
          errors={nameError ? [{ fieldId: nameId, message: nameError }] : []}
          focusKey={attempts}
        />
        {failure ? (
          <Notice tone="danger" alert title="The artist was not created">
            {failure}
          </Notice>
        ) : null}
        <Field
          id={nameId}
          label="Name"
          error={nameError}
          description={
            nameStatus
              ? nameStatus.available
                ? "This web address is free."
                : `That web address is taken. Try: ${nameStatus.suggestions.join(", ")}`
              : undefined
          }
        >
          <TextInput
            value={displayName}
            maxLength={200}
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (nameError && event.target.value.trim()) setNameError(null);
            }}
          />
        </Field>
        <Field label="Kind">
          <EnumSelect<ArtistKind>
            value={kind}
            options={ARTIST_KIND_OPTIONS}
            onValueChange={(next) => next && setKind(next)}
          />
        </Field>
        <FieldRow>
          <Field label="Nationality" optional>
            <TextInput
              value={nationality}
              maxLength={100}
              onChange={(event) => setNationality(event.target.value)}
            />
          </Field>
          <Field label="Born" optional>
            <TextInput
              value={birthYear}
              maxLength={10}
              placeholder="e.g. 1923"
              onChange={(event) => setBirthYear(event.target.value)}
            />
          </Field>
        </FieldRow>
        <Field label="Died" optional>
          <TextInput
            value={deathYear}
            maxLength={10}
            placeholder="e.g. 1998"
            onChange={(event) => setDeathYear(event.target.value)}
          />
        </Field>
        <Field label="Short bio" optional>
          <TextArea
            value={shortBio}
            rows={3}
            maxLength={500}
            onChange={(event) => setShortBio(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
