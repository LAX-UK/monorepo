"use client";

import { RunFields } from "@/components/artworks/edition-runs/run-fields.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  proofsKeptInput,
  runErrorSummary,
  runFormValues,
  runSpecInput,
  validateRunForm,
} from "@/lib/edition-run-form";
import { saveEditionRun } from "@/server/application/edition-run-actions.server";
import { RUN_LOCKED_NOTICE, mainRunLine, runSummaryText } from "@/server/domain/edition-run.vm";
import type { AdminEditionRunDetail } from "@auction/shop-contracts";
import {
  FormActions,
  FormErrorSummary,
  FormSection,
  KeyValueList,
  Notice,
  StaffButton,
  TextLink,
  toast,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PROOF_NAMES = [
  ["ap", "artist's proofs"],
  ["pp", "printer's proofs"],
  ["hc", "hors commerce"],
  ["bat", "bon à tirer"],
] as const;

function proofsKeptText(kept: AdminEditionRunDetail["proofsKept"]): string {
  const parts = PROOF_NAMES.filter(([key]) => kept[key] > 0).map(
    ([key, name]) => `${kept[key]} ${name}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "None recorded";
}

/**
 * The run on the editor page: what it is and the proofs kept, the run it belongs to for a proof
 * or companion listing, and, until a print is offered for sale, a way to change it. Saved on its
 * own; a changed run plans its prints again and needs its facts confirmed again.
 */
export function EditionRunCard({
  artworkId,
  run,
  version,
  linkedToOriginal,
  canWrite,
  onSaved,
}: {
  artworkId: string;
  run: AdminEditionRunDetail;
  /** The artwork's version; changing the run moves it on. */
  version: string;
  linkedToOriginal: boolean;
  canWrite: boolean;
  onSaved: (version: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => runFormValues(run.spec, run.proofsKept));
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const locked = run.locks.sizeAndAllocationLocked;
  const editable = canWrite && !locked && run.spec.type !== "proof";
  const context = { linkedToOriginal };
  const errors = failedSubmits > 0 ? validateRunForm(values, context) : {};

  async function submit() {
    if (Object.keys(validateRunForm(values, context)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await saveEditionRun({
      artworkId,
      body: {
        spec: runSpecInput(values),
        proofsKept: proofsKeptInput(values),
        expectedVersion: version,
      },
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setFormError(
        result.kind === "conflict" && result.currentVersion
          ? "Someone else saved this artwork after you opened it. Reload the page first."
          : adminMutationErrorMessage(result),
      );
      return;
    }
    setEditing(false);
    setFailedSubmits(0);
    setIdempotencyKey(crypto.randomUUID());
    onSaved(result.data.version);
    toast.success("Run saved. Confirm the edition facts again before publishing.");
    router.refresh();
  }

  return (
    <form
      noValidate
      aria-label="Run of prints"
      className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormSection
        title="Run"
        description="The prints this listing sells. Fixed once prints are offered for sale."
      >
        <FormErrorSummary
          errors={failedSubmits > 0 ? runErrorSummary(errors) : []}
          focusKey={failedSubmits}
        />
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        {editing ? (
          <RunFields
            values={values}
            errors={errors}
            linkedToOriginal={linkedToOriginal}
            showFirstBatch={false}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          />
        ) : (
          <>
            <KeyValueList
              items={[
                { label: "Run", value: runSummaryText(run.spec) },
                ...(run.spec.type === "proof"
                  ? []
                  : [{ label: "Proofs kept", value: proofsKeptText(run.proofsKept) }]),
                ...(run.mainRun
                  ? [
                      {
                        label: "Main run",
                        value: (
                          <TextLink href={`/artworks/${run.mainRun.artworkId}`} Link={Link}>
                            {mainRunLine(run.mainRun)}
                          </TextLink>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {locked ? <Notice title={RUN_LOCKED_NOTICE} /> : null}
          </>
        )}
      </FormSection>
      {editable ? (
        <FormActions className="border-t border-staff-line-subtle pt-4">
          {editing ? (
            <>
              <StaffButton
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setValues(runFormValues(run.spec, run.proofsKept));
                  setFailedSubmits(0);
                }}
              >
                Cancel
              </StaffButton>
              <StaffButton type="submit" variant="primary" loading={saving}>
                Save run
              </StaffButton>
            </>
          ) : (
            <StaffButton type="button" variant="secondary" onClick={() => setEditing(true)}>
              Change run
            </StaffButton>
          )}
        </FormActions>
      ) : null}
    </form>
  );
}
