"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { putWithProgress } from "@/lib/shop-media-upload.client";
import {
  addConsignorAgreement,
  replaceConsignorAgreement,
  requestAgreementFileUpload,
} from "@/server/application/admin-consignor-agreement-actions.server";
import {
  AGREEMENT_FIELD_LABELS,
  AGREEMENT_FILE_ACCEPT,
  AGREEMENT_FORM_FIELDS,
  AGREEMENT_NOTE_MAX_LENGTH,
  type AgreementFormErrors,
  type AgreementFormField,
  type AgreementFormValues,
  CONSIGNMENT_PLACES,
  PLACE_LABELS,
  agreementFileProblem,
  agreementFormValues,
  checkAgreementForm,
  fieldErrorsFromIssues,
} from "@/server/domain/consignor-agreement.vm";
import type { AdminConsignorAgreement } from "@auction/shop-contracts";
import {
  ChoiceFieldset,
  ChoiceRow,
  DateInput,
  Field,
  FileDropzone,
  FormErrorSummary,
  MoneyInput,
  Notice,
  PercentInput,
  StaffButton,
  StaffCheckbox,
  TextArea,
} from "@auction/staff-ui";
import { FileText, X } from "@auction/staff-ui/icons";
import { useId, useState } from "react";
import { useAgreementWrite } from "./use-agreement-write.client";

type Upload =
  | { state: "idle" }
  | { state: "uploading"; name: string; percent: number }
  | { state: "done"; name: string }
  | { state: "failed"; message: string };

/**
 * Add an agreement for the consignor, or replace one (`agreement` set) with its next version,
 * starting from its terms. Never edits in place: a replace adds version N+1 and keeps version N
 * in the history. The signed file is uploaded as soon as it is chosen, straight to private
 * storage; a replace keeps the agreement's file unless a new one is chosen. A failed save lists
 * every problem at the top and beside each field, in shop-api's words. Saving needs a recent
 * sign-in, which the kit's "Confirm it's you" dialog offers when it is missing.
 */
export function AgreementDialog({
  partyId,
  consignorName,
  agreement,
  onClose,
}: {
  partyId: string;
  consignorName: string;
  /** The agreement being replaced, at the version the page has; null to add one. */
  agreement: AdminConsignorAgreement | null;
  onClose: () => void;
}) {
  const write = useAgreementWrite();
  const base = useId();
  const fieldId = (field: AgreementFormField) => `${base}-${field}`;
  const [values, setValues] = useState<AgreementFormValues>(() => agreementFormValues(agreement));
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [submits, setSubmits] = useState(0);
  const checked = checkAgreementForm(values);
  const errors: AgreementFormErrors = {
    ...(submits > 0 && !checked.ok ? checked.errors : {}),
    ...fieldErrorsFromIssues(write.issues),
    ...(upload.state === "failed" ? { signedFileKey: upload.message } : {}),
  };
  const set = <K extends keyof AgreementFormValues>(field: K, value: AgreementFormValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }));
  const keepsFile = agreement !== null && values.signedFileKey === agreement.signedFileKey;

  async function chooseFile(file: File) {
    const problem = agreementFileProblem(file);
    if (problem) {
      setUpload({ state: "failed", message: problem });
      return;
    }
    setUpload({ state: "uploading", name: file.name, percent: 0 });
    set("signedFileKey", null);
    const target = await requestAgreementFileUpload({
      partyId,
      contentType: file.type,
      byteSize: file.size,
    });
    if (!target.ok) {
      setUpload({
        state: "failed",
        message:
          target.kind === "forbidden"
            ? "You cannot upload agreements."
            : "The file could not be uploaded. Try again in a moment.",
      });
      return;
    }
    try {
      await putWithProgress(
        target.data.uploadUrl,
        file,
        target.data.requiredHeaders,
        (loaded, total) =>
          setUpload({
            state: "uploading",
            name: file.name,
            percent: Math.round((loaded / total) * 100),
          }),
      );
      set("signedFileKey", target.data.key);
      setUpload({ state: "done", name: file.name });
    } catch {
      setUpload({ state: "failed", message: "The file could not be uploaded. Try again." });
    }
  }

  async function submit() {
    setSubmits((count) => count + 1);
    if (!checked.ok || upload.state === "uploading") return;
    const terms = checked.body;
    const ok = await write.run(
      () =>
        agreement
          ? replaceConsignorAgreement({
              partyId,
              agreementId: agreement.agreementId,
              expectedVersion: agreement.version,
              terms,
              idempotencyKey: write.idempotencyKey,
            })
          : addConsignorAgreement({ partyId, terms, idempotencyKey: write.idempotencyKey }),
      agreement
        ? `Agreement with ${consignorName} replaced with version ${agreement.version + 1}`
        : `Agreement with ${consignorName} added`,
      agreement ? "replace this agreement" : "add an agreement",
    );
    if (ok) onClose();
  }

  const summary = AGREEMENT_FORM_FIELDS.flatMap((field) =>
    errors[field]
      ? [{ fieldId: fieldId(field), message: `${AGREEMENT_FIELD_LABELS[field]}: ${errors[field]}` }]
      : [],
  );

  const togglePlace = (place: (typeof CONSIGNMENT_PLACES)[number], on: boolean) =>
    set(
      "places",
      on ? [...values.places, place] : values.places.filter((current) => current !== place),
    );

  return (
    <>
      <StaffFormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={agreement ? `Replace agreement, version ${agreement.version}` : "Add agreement"}
        description={
          agreement
            ? `Saves version ${agreement.version + 1} with these terms. Version ${agreement.version} is kept in the history.`
            : `What ${consignorName} agreed LAX may sell, where and on what terms.`
        }
        submitLabel={agreement ? "Save new version" : "Add agreement"}
        pending={write.pending || upload.state === "uploading"}
        onSubmit={() => void submit()}
      >
        <FormErrorSummary focusKey={submits} errors={summary} />
        {write.error}
        <ChoiceFieldset
          id={fieldId("places")}
          legend={AGREEMENT_FIELD_LABELS.places}
          description="Where LAX may offer their works."
          error={errors.places}
        >
          {CONSIGNMENT_PLACES.map((place) => (
            <ChoiceRow
              key={place}
              htmlFor={`${base}-place-${place}`}
              control={
                <StaffCheckbox
                  id={`${base}-place-${place}`}
                  checked={values.places.includes(place)}
                  onCheckedChange={(on) => togglePlace(place, on === true)}
                />
              }
              label={PLACE_LABELS[place]}
            />
          ))}
        </ChoiceFieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={fieldId("startsOn")}
            label={AGREEMENT_FIELD_LABELS.startsOn}
            error={errors.startsOn}
          >
            <DateInput value={values.startsOn} onValueChange={(day) => set("startsOn", day)} />
          </Field>
          <Field
            id={fieldId("endsOn")}
            label={AGREEMENT_FIELD_LABELS.endsOn}
            description="Empty: until it is retired."
            error={errors.endsOn}
            optional
          >
            <DateInput
              value={values.endsOn}
              onValueChange={(day) => set("endsOn", day)}
              {...(values.startsOn ? { min: values.startsOn } : {})}
            />
          </Field>
          <Field
            id={fieldId("lowestPricePence")}
            label={AGREEMENT_FIELD_LABELS.lowestPricePence}
            description="Staff are warned when a price is set below it."
            error={errors.lowestPricePence}
            optional
          >
            <MoneyInput
              value={values.lowestPricePence}
              onValueChange={(pence, parsed) =>
                setValues((current) => ({
                  ...current,
                  lowestPricePence: pence,
                  lowestPriceTyped: parsed.ok || parsed.reason !== "empty",
                }))
              }
            />
          </Field>
          <Field
            id={fieldId("commissionBasisPoints")}
            label={AGREEMENT_FIELD_LABELS.commissionBasisPoints}
            error={errors.commissionBasisPoints}
            optional
          >
            <PercentInput
              value={values.commissionRate ?? ""}
              onValueChange={(rate) => set("commissionRate", rate)}
            />
          </Field>
        </div>
        <Field
          id={fieldId("signedFileKey")}
          label={AGREEMENT_FIELD_LABELS.signedFileKey}
          description="PDF, JPEG or PNG, up to 20 MB. Kept privately; staff open it with a link that lasts a few minutes."
          error={errors.signedFileKey}
        >
          {upload.state === "uploading" ? (
            <Notice tone="info" title={`Uploading ${upload.name}`}>
              {upload.percent}% sent
            </Notice>
          ) : upload.state === "done" || keepsFile ? (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-staff-md border border-staff-line px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-staff-sm text-staff-fg">
                <FileText aria-hidden className="size-4 shrink-0 text-staff-muted" />
                <span className="truncate">
                  {upload.state === "done"
                    ? upload.name
                    : `The signed file of version ${agreement?.version ?? 1}`}
                </span>
              </span>
              <StaffButton
                size="sm"
                variant="ghost"
                icon={<X aria-hidden />}
                onClick={() => {
                  set("signedFileKey", null);
                  setUpload({ state: "idle" });
                }}
              >
                {upload.state === "done" ? "Remove" : "Choose another"}
              </StaffButton>
            </div>
          ) : (
            <FileDropzone
              kind="file"
              accept={AGREEMENT_FILE_ACCEPT}
              label="Upload the signed agreement"
              hint="PDF, JPEG or PNG, up to 20 MB"
              onFiles={(files) => {
                const [file] = files;
                if (file) void chooseFile(file);
              }}
            />
          )}
        </Field>
        <Field
          id={fieldId("note")}
          label={AGREEMENT_FIELD_LABELS.note}
          description="Anything staff should know, such as special terms."
          error={errors.note}
          optional
        >
          <TextArea
            rows={3}
            maxLength={AGREEMENT_NOTE_MAX_LENGTH}
            value={values.note}
            onChange={(event) => set("note", event.target.value)}
          />
        </Field>
      </StaffFormDialog>
      {write.stepUpDialog}
    </>
  );
}
