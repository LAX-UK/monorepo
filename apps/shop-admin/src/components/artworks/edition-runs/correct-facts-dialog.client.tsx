"use client";

import { EditionFactsFields } from "@/components/artworks/edition-runs/edition-facts-fields.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  factsErrorSummary,
  factsFormValues,
  factsInput,
  validateFactsForm,
  withRun,
} from "@/lib/edition-facts-form";
import { correctEditionFacts } from "@/server/application/edition-run-actions.server";
import { type AdminEditionRunDetail, FACTS_REASON_MAX_LENGTH } from "@auction/shop-contracts";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  formatStaffDate,
  toast,
} from "@auction/staff-ui";
import { useState } from "react";

const FORM_ID = "correct-edition-facts";

/**
 * "Correct edition facts", for shop admins after a sale: the facts as they should read, why, and
 * the paid orders it affects. Those orders keep the description they were sold with.
 */
export function CorrectFactsDialog({
  open,
  onOpenChange,
  artworkId,
  run,
  factsVersion,
  onCorrected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  run: AdminEditionRunDetail;
  factsVersion: string | null;
  onCorrected: (factsVersion: string) => void;
}) {
  const [values, setValues] = useState(() => withRun(factsFormValues(run.facts, true), run.spec));
  const [reason, setReason] = useState("");
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const attempted = failedSubmits > 0;
  const factsErrors = attempted ? validateFactsForm(values, run.spec) : {};
  const reasonError =
    attempted && !reason.trim() ? "Say why the edition facts are being corrected" : undefined;
  const summary = [
    ...factsErrorSummary(factsErrors),
    ...(reasonError ? [{ fieldId: "correct-facts-reason", message: reasonError }] : []),
  ];

  async function submit() {
    const facts = factsInput(values);
    if (!facts || Object.keys(validateFactsForm(values, run.spec)).length > 0 || !reason.trim()) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await correctEditionFacts({
      artworkId,
      body: { facts, reason: reason.trim(), expectedFactsVersion: factsVersion },
      idempotencyKey,
    }).catch(
      () => ({ ok: false, kind: "failed", message: "Correction failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    toast.success(
      result.data.affectedOrders === 1
        ? "Edition facts corrected. 1 order keeps its original description."
        : `Edition facts corrected. ${result.data.affectedOrders} orders keep their original description.`,
    );
    onOpenChange(false);
    onCorrected(result.data.factsVersion);
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      size="lg"
      title="Correct edition facts"
      description="Prints of this run have sold. The orders already paid keep the description they were sold with; new orders use the corrected facts."
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            Correct edition facts
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
        <FormErrorSummary errors={attempted ? summary : []} focusKey={failedSubmits} />
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        <EditionFactsFields
          values={values}
          errors={factsErrors}
          spec={run.spec}
          onChange={(patch) => setValues((current) => withRun({ ...current, ...patch }, run.spec))}
        />
        <Field
          label="Reason"
          description="Kept in the audit log with the orders it affects."
          error={reasonError}
          id="correct-facts-reason"
        >
          <TextArea
            rows={3}
            maxLength={FACTS_REASON_MAX_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <section aria-label="Orders affected" className="flex flex-col gap-2">
          <h3 className="text-staff-sm font-medium text-staff-fg">
            {run.paidOrderCount === 1 ? "1 sale affected" : `${run.paidOrderCount} sales affected`}
          </h3>
          {run.affectedOrders.length > 0 ? (
            <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
              {run.affectedOrders.map((order) => (
                <li
                  key={order.orderId}
                  className="flex items-center justify-between gap-4 px-3 py-2 text-staff-sm"
                >
                  <span className="font-medium text-staff-fg tabular-nums">{order.reference}</span>
                  <span className="text-staff-muted">
                    {order.paidAt ? `Paid ${formatStaffDate(order.paidAt)}` : "Paid"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-staff-sm text-staff-muted">
              Prints sold outside an order, such as a third-party sale.
            </p>
          )}
        </section>
      </form>
    </StaffDialog>
  );
}
