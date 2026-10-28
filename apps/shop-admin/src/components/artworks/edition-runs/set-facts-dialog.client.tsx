"use client";

import { EditionFactsFields } from "@/components/artworks/edition-runs/edition-facts-fields.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  emptyFactsForm,
  factsErrorSummary,
  factsFieldId,
  factsInput,
  validateFactsForm,
} from "@/lib/edition-facts-form";
import { setEditionFactsForRuns } from "@/server/application/edition-run-actions.server";
import { bulkFactsSummary } from "@/server/domain/edition-run.vm";
import type { AdminArtworkListItem } from "@auction/shop-contracts";
import {
  ChoiceRow,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  toast,
} from "@auction/staff-ui";
import { useState } from "react";

const FORM_ID = "set-edition-facts";

/**
 * "Set edition facts" for a selection of runs, such as a batch of unsigned prints. Runs with paid
 * orders are left as they are, because their sold prints were described as they were; runs the
 * facts do not fit (a number on an open edition) are refused. Each outcome is reported.
 */
export function SetFactsDialog({
  open,
  onOpenChange,
  rows,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly AdminArtworkListItem[];
  onDone: () => void;
}) {
  const [values, setValues] = useState(emptyFactsForm);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const runs = rows.filter((row) => row.run !== null);
  const sold = runs.filter((row) => row.run?.factsLocked).length;
  const errors = failedSubmits > 0 ? validateFactsForm(values, null) : {};

  function reset(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyFactsForm());
      setFailedSubmits(0);
      setFormError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const facts = factsInput(values);
    if (!facts || Object.keys(validateFactsForm(values, null)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await setEditionFactsForRuns({
      body: {
        artworkIds: runs.map((row) => row.artworkId),
        facts,
        confirmed: values.confirmed,
      },
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Saving failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    const titleOf = (id: string) => runs.find((row) => row.artworkId === id)?.title ?? "A run";
    const summary = bulkFactsSummary(result.data, titleOf);
    if (summary.tone === "success") toast.success(summary.message);
    else toast.warning(summary.message, { description: summary.details.join(" ") });
    onOpenChange(false);
    onDone();
  }

  const count = runs.length === 1 ? "1 run" : `${runs.length} runs`;
  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      size="md"
      title={`Set edition facts for ${count}`}
      description="The same signature, numbering and certificate for every selected run."
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => reset(false)}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            Set edition facts
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
        <FormErrorSummary
          errors={failedSubmits > 0 ? factsErrorSummary(errors) : []}
          focusKey={failedSubmits}
        />
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        {sold > 0 ? (
          <Notice title={sold === 1 ? "1 run has sold prints" : `${sold} runs have sold prints`}>
            They keep their facts: sold prints were described that way.
          </Notice>
        ) : null}
        <EditionFactsFields
          values={values}
          errors={errors}
          spec={null}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        />
        <ChoiceRow
          htmlFor={factsFieldId("confirmed")}
          control={
            <StaffCheckbox
              id={factsFieldId("confirmed")}
              checked={values.confirmed}
              onCheckedChange={(checked) =>
                setValues((current) => ({ ...current, confirmed: checked === true }))
              }
            />
          }
          label="I have checked these facts against the prints or the publisher's records"
          description="Publishing waits until the facts are confirmed."
        />
      </form>
    </StaffDialog>
  );
}
