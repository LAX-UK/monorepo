"use client";

import { CorrectFactsDialog } from "@/components/artworks/edition-runs/correct-facts-dialog.client";
import { EditionFactsFields } from "@/components/artworks/edition-runs/edition-facts-fields.client";
import { FactsPreview } from "@/components/artworks/edition-runs/facts-preview";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  factsErrorSummary,
  factsFieldId,
  factsFormValues,
  factsInput,
  factsPreview,
  isFactsFormDirty,
  validateFactsForm,
  withRun,
} from "@/lib/edition-facts-form";
import { saveEditionFacts } from "@/server/application/edition-run-actions.server";
import {
  FACTS_LOCKED_TITLE,
  factsLockedBody,
  factsStatusLabel,
} from "@/server/domain/edition-run.vm";
import type { AdminEditionRunDetail } from "@auction/shop-contracts";
import {
  ChoiceRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  Notice,
  StaffButton,
  StaffCheckbox,
  StatusBadge,
  formatStaffDate,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EditionFactsPermissions = {
  /** `catalogue.write`: record and confirm the facts while nothing has sold. */
  write: boolean;
  /** `edition_facts.correct`: shop admins correct facts after a sale. */
  correct: boolean;
};

/**
 * The editor's "Edition facts" card: what shoppers are told about every print, with the live
 * "Shoppers will see" preview and the confirmation that publishing waits for. Saved on its own,
 * apart from the artwork's details. After the first sale it is read-only, and shop admins can
 * use "Correct edition facts".
 */
export function EditionFactsCard({
  artworkId,
  title,
  run,
  permissions,
}: {
  artworkId: string;
  title: string;
  run: AdminEditionRunDetail;
  permissions: EditionFactsPermissions;
}) {
  const router = useRouter();
  const initial = withRun(factsFormValues(run.facts, run.factsConfirmed !== null), run.spec);
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [version, setVersion] = useState(run.factsVersion);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const locked = run.locks.factsLocked;
  const readOnly = locked || !permissions.write;
  const dirty = isFactsFormDirty(values, baseline);
  const attempted = failedSubmits > 0;
  const errors = attempted ? validateFactsForm(values, run.spec) : {};
  const preview = factsPreview(values, run.spec, run.proofsKept);
  const status = factsStatusLabel(run.factsConfirmed, formatStaffDate);

  function update(patch: Partial<typeof values>) {
    setValues((current) => withRun({ ...current, ...patch }, run.spec));
  }

  async function submit() {
    const found = validateFactsForm(values, run.spec);
    const facts = factsInput(values);
    if (Object.keys(found).length > 0 || !facts) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await saveEditionFacts({
      artworkId,
      body: { facts, confirmed: values.confirmed, expectedFactsVersion: version },
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setFormError(
        result.kind === "conflict" && result.currentVersion
          ? "Someone else changed these facts after you opened them. Reload the page to see their version."
          : adminMutationErrorMessage(result),
      );
      toast.error("The edition facts were not saved");
      return;
    }
    setVersion(result.data.factsVersion);
    setBaseline(values);
    setFailedSubmits(0);
    setIdempotencyKey(crypto.randomUUID());
    toast.success(
      result.data.confirmed ? "Edition facts saved and confirmed" : "Edition facts saved",
    );
    router.refresh();
  }

  return (
    <>
      <form
        noValidate
        aria-label={`Edition facts for ${title}`}
        className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormSection
          title="Edition facts"
          description={
            <span className="flex flex-col items-start gap-2">
              What shoppers are told about every print in this run.
              <StatusBadge tone={status.confirmed ? "success" : "warning"}>
                {status.label}
              </StatusBadge>
            </span>
          }
        >
          <FormErrorSummary
            errors={attempted ? factsErrorSummary(errors) : []}
            focusKey={failedSubmits}
          />
          {locked ? (
            <Notice
              tone="info"
              title={FACTS_LOCKED_TITLE}
              actions={
                permissions.correct ? (
                  <StaffButton size="sm" variant="secondary" onClick={() => setCorrecting(true)}>
                    Correct edition facts
                  </StaffButton>
                ) : undefined
              }
            >
              {factsLockedBody({
                paidOrderCount: run.paidOrderCount,
                canCorrect: permissions.correct,
              })}
            </Notice>
          ) : null}
          {formError ? <Notice tone="danger" alert title={formError} /> : null}
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <EditionFactsFields
              values={values}
              errors={errors}
              spec={run.spec}
              readOnly={readOnly}
              onChange={update}
            />
            <div className="xl:sticky xl:top-20 xl:self-start">
              <FactsPreview preview={preview} />
            </div>
          </div>
          {readOnly ? null : (
            <ChoiceRow
              htmlFor={factsFieldId("confirmed")}
              control={
                <StaffCheckbox
                  id={factsFieldId("confirmed")}
                  checked={values.confirmed}
                  onCheckedChange={(checked) => update({ confirmed: checked === true })}
                />
              }
              label="I have checked these facts against the print or the publisher's records"
              description="Publishing waits until the facts are confirmed."
            />
          )}
        </FormSection>
        {readOnly ? null : (
          <FormActions className="border-t border-staff-line-subtle pt-4">
            <StaffButton
              type="button"
              variant="secondary"
              disabled={!dirty || saving}
              onClick={() => {
                setValues(baseline);
                setFailedSubmits(0);
              }}
            >
              Discard changes
            </StaffButton>
            <StaffButton type="submit" variant="primary" loading={saving} disabled={!dirty}>
              {dirty ? "Save edition facts" : "Saved"}
            </StaffButton>
          </FormActions>
        )}
      </form>
      {permissions.correct && locked ? (
        <CorrectFactsDialog
          open={correcting}
          onOpenChange={setCorrecting}
          artworkId={artworkId}
          run={run}
          factsVersion={version}
          onCorrected={(next) => {
            setVersion(next);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
