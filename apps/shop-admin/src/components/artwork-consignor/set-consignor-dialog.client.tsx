"use client";

import { useAgreementWrite } from "@/components/consignor-agreements/use-agreement-write.client";
import { PartyPicker } from "@/components/pickers/record-pickers.client";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { setArtworkConsignor } from "@/server/application/admin-artwork-consignor-actions.server";
import {
  CONSIGNOR_FIELD_LABELS,
  CONSIGNOR_FORM_FIELDS,
  CONSIGNOR_REASON_MAX_LENGTH,
  type ConsignorFormErrors,
  type ConsignorFormField,
  type ConsignorFormValues,
  LAX_OWNS_LABEL,
  checkConsignorForm,
  consignorErrorsFromIssues,
  consignorFormValues,
  consignorName,
} from "@/server/domain/artwork-consignor.vm";
import type { AdminConsignorChange } from "@auction/shop-contracts";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FormErrorSummary,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
} from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * Set who consigned the artwork, or change it. A client is picked by name or email; "LAX owns
 * this work" needs no client. The first time needs no reason; every change after it does, and
 * the old consignor stays in the history. One problem shows beside its field; two or more are
 * also listed at the top. Saving needs a recent sign-in, which the kit's "Confirm it's you"
 * dialog offers when it is missing. Someone else's change meanwhile is refused, with Reload.
 */
export function SetConsignorDialog({
  registerId,
  title,
  current,
  onClose,
}: {
  registerId: string;
  /** The artwork's title. */
  title: string;
  /** The consignor the page read; null when none is set. */
  current: AdminConsignorChange | null;
  onClose: () => void;
}) {
  const write = useAgreementWrite({ staleTitle: "Someone else changed the consignor" });
  const base = useId();
  const fieldId = (field: ConsignorFormField) => `${base}-${field}`;
  const [values, setValues] = useState<ConsignorFormValues>(() => consignorFormValues(current));
  const [submits, setSubmits] = useState(0);
  const checked = checkConsignorForm(values, current);
  const errors: ConsignorFormErrors = {
    ...(submits > 0 && !checked.ok ? checked.errors : {}),
    ...consignorErrorsFromIssues(write.issues),
  };
  const set = <K extends keyof ConsignorFormValues>(field: K, value: ConsignorFormValues[K]) =>
    setValues((now) => ({ ...now, [field]: value }));

  async function submit() {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await write.run(
      () => setArtworkConsignor({ registerId, body, idempotencyKey: write.idempotencyKey }),
      `Consignor of ${title} set to ${
        body.consignor.kind === "lax" ? LAX_OWNS_LABEL : (values.client?.label ?? "the client")
      }`,
      current ? "change the consignor" : "set the consignor",
    );
    if (ok) onClose();
  }

  // One field at fault shows beside it only; two or more are also listed at the top.
  const faults = CONSIGNOR_FORM_FIELDS.flatMap((field) =>
    errors[field]
      ? [{ fieldId: fieldId(field), message: `${CONSIGNOR_FIELD_LABELS[field]}: ${errors[field]}` }]
      : [],
  );

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={current ? "Change consignor" : "Set consignor"}
        description={
          current
            ? `${title} is consigned by ${consignorName(current.consignor)}. The change is kept in its history.`
            : `Who consigned ${title} to LAX.`
        }
        submitLabel={current ? "Change consignor" : "Set consignor"}
        pending={write.pending}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary focusKey={submits} errors={faults.length > 1 ? faults : []} />
        {write.error}
        <ChoiceFieldset
          id={fieldId("kind")}
          legend={CONSIGNOR_FIELD_LABELS.kind}
          error={errors.kind}
        >
          <StaffRadioGroup
            aria-label={CONSIGNOR_FIELD_LABELS.kind}
            value={values.kind ?? ""}
            onValueChange={(kind) => set("kind", kind as ConsignorFormValues["kind"])}
          >
            <ChoiceRow
              htmlFor={`${base}-client-kind`}
              control={<StaffRadio id={`${base}-client-kind`} value="client" />}
              label="A client"
              description="Their agreements decide where LAX may offer the work."
            />
            <ChoiceRow
              htmlFor={`${base}-lax-kind`}
              control={<StaffRadio id={`${base}-lax-kind`} value="lax" />}
              label={LAX_OWNS_LABEL}
              description="No agreement is needed."
            />
          </StaffRadioGroup>
        </ChoiceFieldset>
        {values.kind === "client" ? (
          <Field id={fieldId("client")} label={CONSIGNOR_FIELD_LABELS.client} error={errors.client}>
            <PartyPicker
              value={values.client}
              onChange={(client) => set("client", client)}
              invalid={Boolean(errors.client)}
            />
          </Field>
        ) : null}
        {current ? (
          <Field
            id={fieldId("reason")}
            label={CONSIGNOR_FIELD_LABELS.reason}
            description="Kept in the artwork's history."
            error={errors.reason}
          >
            <TextArea
              rows={3}
              maxLength={CONSIGNOR_REASON_MAX_LENGTH}
              value={values.reason}
              onChange={(event) => set("reason", event.target.value)}
            />
          </Field>
        ) : null}
      </StaffFormDialog>
      {write.stepUpDialog}
    </>
  );
}
