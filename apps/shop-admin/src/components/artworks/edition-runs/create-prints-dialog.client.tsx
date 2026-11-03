"use client";

import { OriginalPrintsFields } from "@/components/artworks/edition-runs/original-prints-fields.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type OriginalPrintsFormValues,
  createPrintsLabel,
  emptyOriginalPrintsForm,
  originalPrintsBody,
  originalPrintsCount,
  validateOriginalPrintsForm,
} from "@/lib/original-prints-form";
import { createPrintsFromOriginal } from "@/server/application/edition-run-actions.server";
import { presentArtworkState } from "@/server/domain/artwork-list.vm";
import { printsCreatedLine } from "@/server/domain/edition-run.vm";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { MappedStatusBadge, Notice, StaffButton, StaffDialog, toast } from "@auction/staff-ui";
import Link from "next/link";
import { useState } from "react";

const FORM_ID = "create-prints";

type LinkedPrints = NonNullable<AdminArtworkDetail["linkedPrints"]>;

/**
 * "Create prints" on a saved original: the same run settings as a new original's "Also create
 * prints" section, creating a Shop draft linked to it. A second set is allowed, so the prints
 * already linked are listed first.
 */
export function CreatePrintsDialog({
  open,
  onOpenChange,
  artworkId,
  title,
  linked,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  title: string;
  /** Prints already made from this original. */
  linked: LinkedPrints;
  onCreated: () => void;
}) {
  const [values, setValues] = useState<OriginalPrintsFormValues>(() =>
    emptyOriginalPrintsForm(true),
  );
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const errors = attempted ? validateOriginalPrintsForm(values, title) : {};

  function reset(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyOriginalPrintsForm(true));
      setAttempted(false);
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  async function submit() {
    if (Object.keys(validateOriginalPrintsForm(values, title)).length > 0) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createPrintsFromOriginal({
      artworkId,
      body: originalPrintsBody(values, title),
      idempotencyKey,
    }).catch(
      () => ({ ok: false, kind: "failed", message: "Creating failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    toast.success(printsCreatedLine(result.data.editionCount), {
      description: "Saved as a Shop draft, linked to this original.",
    });
    onOpenChange(false);
    onCreated();
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      size="md"
      title="Create prints"
      description={`Prints of ${title}, saved as a Shop draft linked to it. The artist, medium, dimensions and images are copied from the original.`}
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => reset(false)}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            {createPrintsLabel(originalPrintsCount(values))}
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        {linked.length > 0 ? (
          <Notice
            tone="warning"
            title={
              linked.length === 1
                ? "This original already has prints"
                : `This original already has ${linked.length} sets of prints`
            }
          >
            <ul className="mt-1 flex flex-col gap-1">
              {linked.map((print) => (
                <li key={print.artworkId} className="flex flex-wrap items-center gap-x-2">
                  <Link
                    href={`/artworks/${print.artworkId}`}
                    className="staff-focus rounded-staff-xs font-medium text-staff-fg underline underline-offset-2"
                  >
                    {print.title}
                  </Link>
                  <MappedStatusBadge status={print.state} present={presentArtworkState} />
                  <span>{print.size === 1 ? "1 print" : `${print.size} prints`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">Creating prints adds another listing; these stay as they are.</p>
          </Notice>
        ) : null}
        <OriginalPrintsFields
          values={values}
          errors={errors}
          originalTitle={title}
          disabled={saving}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        />
      </form>
    </StaffDialog>
  );
}
