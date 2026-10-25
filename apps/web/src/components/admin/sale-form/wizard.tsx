"use client";

import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { staffFormSummaryErrors } from "@/components/admin/forms/staff-form-fields";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
  adminSaleFormValuesSchema,
} from "@/lib/forms/schemas/admin-sale-form";
import { FormActions, FormErrorSummary, Notice, StaffButton } from "@auction/staff-ui";
import type { CategoryNode, EntityDocument, Lot, Venue } from "@auction/types";
import {
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isSaleroomDeliveryMode,
  isUkPostcode,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SALE_FORM_ID } from "./sale-form-id";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleScheduleStep } from "./steps/schedule-step";
import type { StreamUrlVerificationGate } from "./stream-url-verify-control";
import { SALE_STEP_FIELDS, submitSaleForm } from "./use-sale-form-submit";
import { useSaleTierBandPreview } from "./use-sale-tier-preview";

type Props = {
  saleId: string;
  /** Current sale status — when non-draft, schedule/delivery/premium fields are read-only. */
  saleStatus?: string;
  defaultValues: AdminSaleFormValues;
  categories: CategoryNode[];
  /** When true, nested lots on create must use the English auction type (API-enforced). */
  englishOnlyAuctionsLocked?: boolean;
  /** Staff-attached sale documents (edit mode). */
  initialSaleDocuments?: EntityDocument[];
  /** Resolved cover URLs keyed by storage key (edit mode). */
  previewUrlByKey?: Record<string, string>;
  /** DOM id on the root `<form>` for external submit triggers. */
  htmlFormId?: string;
  lots?: Lot[];
  venues?: Venue[];
};

const SUMMARY_ORDER = SALE_STEP_FIELDS.flat().map(String);

/** Edit-only sale form — new sales use {@link SaleSetupWizard} at `/admin/sales/new`. */
export function AdminSaleForm({
  saleId,
  saleStatus,
  defaultValues,
  categories,
  englishOnlyAuctionsLocked: _englishOnlyAuctionsLocked = false,
  initialSaleDocuments = [],
  previewUrlByKey = {},
  htmlFormId,
  lots = [],
  venues = [],
}: Props) {
  const isDraft = !saleStatus || saleStatus === "draft";
  const streamUrlEditable = isDraft || saleStatus === "scheduled" || saleStatus === "active";
  const streamUrlGateRef = useRef<StreamUrlVerificationGate | null>(null);
  const heroVideoUrlGateRef = useRef<StreamUrlVerificationGate | null>(null);
  const formSchema = useMemo(
    () => (isDraft ? adminSaleDraftScheduleSchema() : adminSaleFormValuesSchema),
    [isDraft],
  );
  const [pending, startTransition] = useTransition();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();

  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    // Errors appear on save, then clear as each field is fixed.
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buyerPremiumTiers",
  });
  const tierBandPreview = useSaleTierBandPreview(form);
  const deliveryMode = form.watch("deliveryMode");
  const isSaleroom = isSaleroomDeliveryMode(
    (deliveryMode ?? "online") as "online" | "onsite" | "hybrid",
  );
  const watchedLocation = {
    locationName: form.watch("locationName"),
    locationAddressLine1: form.watch("locationAddressLine1"),
    locationAddressLine2: form.watch("locationAddressLine2"),
    locationCity: form.watch("locationCity"),
    locationCounty: form.watch("locationCounty"),
    locationPostcode: form.watch("locationPostcode"),
    locationCountry: form.watch("locationCountry"),
    locationAddress: form.watch("locationAddress"),
  };
  const formattedPreviewAddress = formatPostalAddress(watchedLocation);
  const previewMapUrl = buildGoogleMapsSearchUrl(watchedLocation);
  const customMapUrl = form.watch("locationMapUrl");
  const postcodeRaw = watchedLocation.locationPostcode ?? "";
  const postcodeIsValid = postcodeRaw.trim() === "" || isUkPostcode(postcodeRaw);
  const failed = () => setFailedAttempts((count) => count + 1);

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <form
        id={htmlFormId ?? SALE_FORM_ID}
        noValidate
        aria-label="Sale"
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            await submitSaleForm(values, {
              saleId,
              isDraft,
              lots,
              form,
              formSchema,
              // One page: every field is already on screen.
              wizardGoTo: () => {},
              onSaveNotice: setSaveNotice,
              onValidationBanner: (message) => {
                if (message) failed();
              },
              router,
              streamUrlGateRef,
              heroVideoUrlGateRef,
            });
            if (form.formState.errors.root) failed();
          });
        }, failed)}
      >
        <FormErrorSummary
          errors={staffFormSummaryErrors(form.formState.errors, SALE_FORM_ID, SUMMARY_ORDER)}
          focusKey={failedAttempts}
        />
        {form.formState.errors.root?.message ? (
          <Notice tone="danger" alert title="The sale was not saved">
            {form.formState.errors.root.message}
          </Notice>
        ) : null}
        {saveNotice ? (
          <Notice
            tone="warning"
            alert
            title="Some lots close outside the new schedule"
            actions={
              <StaffButton asChild size="sm" variant="secondary">
                <Link href={saleSetupHref(saleId, "lots")}>Adjust lots</Link>
              </StaffButton>
            }
          >
            {saveNotice}
          </Notice>
        ) : null}
        <SaleIdentityStep
          form={form}
          categories={categories}
          pending={pending}
          previewUrlByKey={previewUrlByKey}
          initialHeroVideoUrl={defaultValues.heroVideoUrl}
          heroVideoUrlGateRef={heroVideoUrlGateRef}
        />
        <SaleScheduleStep
          form={form}
          isDraft={isDraft}
          isSaleroom={isSaleroom}
          pending={pending}
          fields={fields}
          append={append}
          remove={remove}
          tierBandPreview={tierBandPreview}
          formattedPreviewAddress={formattedPreviewAddress}
          previewMapUrl={previewMapUrl}
          customMapUrl={customMapUrl}
          postcodeIsValid={postcodeIsValid}
          lots={lots}
          venues={venues}
          lotsSetupHref={saleSetupHref(saleId, "lots")}
          streamUrlEditable={streamUrlEditable}
          initialStreamUrl={defaultValues.streamUrl}
          streamUrlGateRef={streamUrlGateRef}
        />
        <SaleDocumentsStep
          form={form}
          saleId={saleId}
          initialSaleDocuments={initialSaleDocuments}
          termsReadOnly={!isDraft}
        />
        <FormActions
          sticky
          start={
            <StaffButton
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => guardedPush(`/admin/sales/${saleId}`)}
            >
              Cancel
            </StaffButton>
          }
        >
          <StaffButton type="submit" variant="primary" loading={pending}>
            Save changes
          </StaffButton>
        </FormActions>
      </form>
    </>
  );
}
