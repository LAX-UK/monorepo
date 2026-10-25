"use client";

import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import {
  StaffEnumField,
  StaffMoneyField,
  StaffTextAreaField,
  StaffTextField,
  staffFieldId,
  staffFormSummaryErrors,
} from "@/components/admin/forms/staff-form-fields";
import {
  type LotEditSectionId,
  useLotEditSectionDirty,
} from "@/components/admin/lot-form/lot-edit-form-context";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { DocumentUploadField } from "@/components/forms/document-upload-field";
import { adminUpdateLotMarketingDetailsResultAction } from "@/lib/actions/admin";
import {
  type AdminLotMarketingFormValues,
  adminLotMarketingFormValuesSchema,
  formValuesToApiPatch,
  marketingDetailsToFormValues,
} from "@/lib/admin/admin-lot-marketing-mappers";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import {
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  ListEditor,
  Notice,
  StaffButton,
} from "@auction/staff-ui";
import type { ArtistProfile, LotMarketingDetails } from "@auction/types";
import { updateLotMarketingDetailsSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useController, useFieldArray, useForm } from "react-hook-form";
import { ArtistAttributionPanel } from "./artist-attribution-panel";

export const LOT_MARKETING_FORM_ID = "lot-copy";

const FIELD_ORDER = ["estimate", "conditionReport", "provenance", "exhibitions", "artistNote"];

const CURRENCIES = [
  { value: "GBP", label: "Pounds sterling (GBP)" },
  { value: "EUR", label: "Euros (EUR)" },
  { value: "USD", label: "US dollars (USD)" },
] as const;

type Props = {
  lotId: string;
  marketingDetails: LotMarketingDetails;
  artists: ArtistProfile[];
  /** The lot's artist; changed on its own by the attribution section. */
  artistId: string | null;
  /** DOM id on the root `<form>` for external submit triggers. */
  htmlFormId?: string;
  lotEditSection?: LotEditSectionId;
};

/**
 * A lot's catalogue copy on one page: who it is attributed to, the pre-sale estimate, its
 * condition, provenance, exhibitions and the note about the artist. Validates on save, then each
 * field again as it changes; the error summary lists what to fix and links to each field.
 */
export function AdminLotMarketingForm({
  lotId,
  marketingDetails,
  artists,
  artistId,
  htmlFormId,
  lotEditSection,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const form = useForm<AdminLotMarketingFormValues>({
    resolver: zodResolver(adminLotMarketingFormValuesSchema),
    defaultValues: marketingDetailsToFormValues(marketingDetails),
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });
  useLotEditSectionDirty(
    "catalog",
    Boolean(lotEditSection === "catalog" && form.formState.isDirty),
  );
  const provenance = useFieldArray({ control: form.control, name: "provenance" });
  const exhibitions = useFieldArray({ control: form.control, name: "exhibitions" });
  const reportPdf = useController({ control: form.control, name: "conditionReport.downloadUrl" });
  const id = htmlFormId ?? LOT_MARKETING_FORM_ID;
  const f = { control: form.control, formId: LOT_MARKETING_FORM_ID } as const;

  const save = form.handleSubmit(
    (values) => {
      setFailure(null);
      const patch = formValuesToApiPatch(values);
      const valid = updateLotMarketingDetailsSchema.safeParse(patch);
      if (!valid.success) {
        setFailure(valid.error.issues.map((issue) => issue.message).join(" "));
        setFailedAttempts((count) => count + 1);
        return;
      }
      startTransition(async () => {
        const result = await adminUpdateLotMarketingDetailsResultAction(lotId, valid.data);
        if (result.ok) {
          form.reset(marketingDetailsToFormValues(valid.data as LotMarketingDetails));
          notify.success("Catalogue copy saved");
          router.refresh();
          return;
        }
        if (result.fieldErrors) {
          applyActionFieldErrors(form, result.fieldErrors);
        }
        setFailure(result.error);
        setFailedAttempts((count) => count + 1);
      });
    },
    () => setFailedAttempts((count) => count + 1),
  );

  return (
    <>
      {!lotEditSection ? <FormDirtyGuard isDirty={form.formState.isDirty} /> : null}
      <ArtistAttributionPanel
        lotId={lotId}
        artists={artists}
        artistId={artistId}
        onSaved={() => router.refresh()}
      />
      <form
        id={id}
        noValidate
        aria-label="Catalogue copy"
        className="flex flex-col gap-6"
        onSubmit={(event) => void save(event)}
      >
        <FormErrorSummary
          errors={staffFormSummaryErrors(form.formState.errors, LOT_MARKETING_FORM_ID, FIELD_ORDER)}
          focusKey={failedAttempts}
        />
        {failure ? (
          <Notice tone="danger" alert title="The catalogue copy was not saved">
            {failure}
          </Notice>
        ) : null}
        <FormSection
          title="Pre-sale estimate"
          description="Shown on the lot page once low, high and currency are set. Leave all three empty to hide it."
        >
          <FieldRow>
            <StaffMoneyField {...f} name="estimate.low" label="Low estimate" optional />
            <StaffMoneyField {...f} name="estimate.high" label="High estimate" optional />
          </FieldRow>
          <StaffEnumField {...f} name="estimate.currency" label="Currency" options={CURRENCIES} />
        </FormSection>
        <FormSection title="Condition" description="What bidders read about the lot's condition.">
          <StaffTextAreaField
            {...f}
            name="conditionReport.summary"
            label="Summary"
            optional
            rows={3}
          />
          <StaffTextAreaField
            {...f}
            name="conditionReport.details"
            label="Details"
            optional
            rows={6}
          />
          <Field
            id={staffFieldId(LOT_MARKETING_FORM_ID, "conditionReport.downloadUrl")}
            label="Condition report file"
            optional
            description="A PDF or image. Bidders download it from the lot page."
            error={reportPdf.fieldState.error?.message}
          >
            <DocumentUploadField
              kind="lot_document"
              valueMode="publicUrl"
              inputId={staffFieldId(LOT_MARKETING_FORM_ID, "conditionReport.downloadUrl")}
              value={reportPdf.field.value?.trim() ? reportPdf.field.value.trim() : null}
              onChange={(next) => reportPdf.field.onChange(next ?? "")}
              busy={pending}
            />
          </Field>
        </FormSection>
        <FormSection title="Provenance" description="Who has owned the work, oldest first.">
          <ListEditor
            items={provenance.fields}
            getKey={(item) => item.id}
            itemLabel={(index) => `provenance line ${index + 1}`}
            addLabel="Add provenance line"
            emptyText="No provenance yet."
            max={50}
            disabled={pending}
            onAdd={() => provenance.append({ period: "", note: "" })}
            onRemove={(index) => provenance.remove(index)}
            onMove={(from, to) => provenance.move(from, to)}
            renderItem={(_item, index) => (
              <>
                <StaffTextField
                  {...f}
                  name={`provenance.${index}.period`}
                  label="Period"
                  placeholder="e.g. 2015 to 2018"
                />
                <StaffTextAreaField
                  {...f}
                  name={`provenance.${index}.note`}
                  label="Owner and note"
                  rows={2}
                />
              </>
            )}
          />
        </FormSection>
        <FormSection title="Exhibited" description="Where the work has been shown.">
          <ListEditor
            items={exhibitions.fields}
            getKey={(item) => item.id}
            itemLabel={(index) => `exhibition ${index + 1}`}
            addLabel="Add exhibition"
            emptyText="No exhibitions yet."
            max={50}
            disabled={pending}
            onAdd={() => exhibitions.append({ year: "", venue: "", note: "" })}
            onRemove={(index) => exhibitions.remove(index)}
            onMove={(from, to) => exhibitions.move(from, to)}
            renderItem={(_item, index) => (
              <>
                <FieldRow>
                  <StaffTextField
                    {...f}
                    name={`exhibitions.${index}.year`}
                    label="Year"
                    integer={false}
                    inputMode="numeric"
                    placeholder="2020"
                  />
                  <StaffTextField {...f} name={`exhibitions.${index}.venue`} label="Venue" />
                </FieldRow>
                <StaffTextAreaField
                  {...f}
                  name={`exhibitions.${index}.note`}
                  label="Note"
                  optional
                  rows={2}
                />
              </>
            )}
          />
        </FormSection>
        <FormSection
          title="About the artist"
          description="A note for this lot. It sits beside the artist's public profile."
        >
          <StaffTextAreaField {...f} name="artistNote" label="Note" optional rows={5} />
        </FormSection>
        <FormActions
          sticky
          start={
            <StaffButton
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => guardedPush(`/admin/lots/${lotId}`)}
            >
              Cancel
            </StaffButton>
          }
        >
          <StaffButton type="submit" variant="primary" loading={pending}>
            Save catalogue copy
          </StaffButton>
        </FormActions>
      </form>
    </>
  );
}
