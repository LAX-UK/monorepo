"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { WizardStepIntro } from "@/components/admin/admin-form-wizard/wizard-step-intro";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { FormRootErrorAlert } from "@/components/admin/form-root-error-alert";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import {
  saleFormStepIntro,
  saleFormStepLabel,
  saleFormValidationBanner,
} from "@/lib/admin/sale-form-step-copy";
import { saleSetupHref } from "@/lib/admin/sale-setup";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
  adminSaleFormValuesSchema,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import type { CategoryNode, EntityDocument, Lot, Venue } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import {
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isSaleroomDeliveryMode,
  isUkPostcode,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleFormReviewStep } from "./steps/form-review-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleScheduleStep } from "./steps/schedule-step";
import {
  SALE_STEP_FIELDS,
  submitSaleForm,
  validateAllSaleWizardSteps,
} from "./use-sale-form-submit";
import { useSaleTierBandPreview } from "./use-sale-tier-preview";

const SALE_FORM_STEPS = [
  { id: "identity", label: "Identity" },
  { id: "schedule", label: "Schedule" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
] as const;

const SALE_WIZARD_FIELD_STEPS = 3;

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
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
  lots?: Lot[];
  venues?: Venue[];
};

/** Edit-only sale form — new sales use {@link SaleSetupWizard} at `/admin/sales/new`. */
export function AdminSaleForm({
  saleId,
  saleStatus,
  defaultValues,
  categories,
  englishOnlyAuctionsLocked = false,
  initialSaleDocuments = [],
  previewUrlByKey = {},
  htmlFormId,
  lots = [],
  venues = [],
}: Props) {
  const isDraft = !saleStatus || saleStatus === "draft";
  const formSchema = useMemo(
    () => (isDraft ? adminSaleDraftScheduleSchema() : adminSaleFormValuesSchema),
    [isDraft],
  );
  const [pending, startTransition] = useTransition();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [validationStepIndex, setValidationStepIndex] = useState<number | null>(null);
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const getValuesRef = useRef(form.getValues);
  getValuesRef.current = form.getValues;

  const validateAllWizardSteps = useCallback(async () => {
    return validateAllSaleWizardSteps(form, formSchema, wizardGoToRef.current);
  }, [form, formSchema]);

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

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit(
            async (values) => {
              setValidationBanner(null);
              setValidationStepIndex(null);
              if (!(await validateAllWizardSteps())) {
                notifyAdminFormValidationFailure({});
                return;
              }
              startTransition(async () => {
                await submitSaleForm(values, {
                  saleId,
                  isDraft,
                  lots,
                  form,
                  formSchema,
                  wizardGoTo: (i) => wizardGoToRef.current(i),
                  onSaveNotice: setSaveNotice,
                  onValidationBanner: (message, stepIndex) => {
                    setValidationBanner(message);
                    setValidationStepIndex(stepIndex ?? null);
                  },
                  router,
                });
              });
            },
            async () => {
              setValidationBanner(null);
              setValidationStepIndex(null);
              const parsed = await formSchema.safeParseAsync(form.getValues());
              if (!parsed.success) {
                const stepIndex = parsed.error.issues[0]?.path[0]
                  ? SALE_STEP_FIELDS.findIndex((fields) =>
                      fields.some((f) => String(f) === String(parsed.error.issues[0]?.path[0])),
                    )
                  : -1;
                if (stepIndex >= 0) {
                  setValidationBanner(
                    saleFormValidationBanner(
                      parsed.error.issues.length,
                      saleFormStepLabel(stepIndex),
                    ),
                  );
                  setValidationStepIndex(stepIndex);
                  wizardGoToRef.current(stepIndex);
                }
                notifyAdminFormValidationFailure({ issues: parsed.error.issues });
                return;
              }
              notifyAdminFormValidationFailure({});
            },
          )}
        >
          {englishOnlyAuctionsLocked ? (
            <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
              English-only mode is on: any lots created with this sale must use the{" "}
              <span className="font-medium text-on-surface">english</span> auction type
            </p>
          ) : null}

          {saveNotice ? (
            <Alert className="border-warning/40 bg-warning/5">
              <AlertDescription className="space-y-2 font-body text-sm text-on-surface-variant">
                <p>{saveNotice}</p>
                <Link
                  href={saleSetupHref(saleId, "lots")}
                  className="font-medium text-link underline underline-offset-2"
                >
                  Open sale setup — Lots step
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}

          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null
                ? {
                    stepLabel: saleFormStepLabel(validationStepIndex),
                    onJumpToStep: () => wizardGoToRef.current(validationStepIndex),
                  }
                : {})}
            />
          ) : null}

          <AdminFormWizard
            steps={SALE_FORM_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            hideStickyOnMobile={Boolean(htmlFormId)}
            showSubmitOnAllSteps
            draft={{
              entityKind: "sale",
              entityId: saleId,
              getValues: () => getValuesRef.current() as Record<string, unknown>,
            }}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={async (stepIndex) => {
              if (stepIndex >= SALE_WIZARD_FIELD_STEPS) return true;
              const fields = SALE_STEP_FIELDS[stepIndex];
              if (!fields?.length) return true;
              return validateWizardStep(form, formSchema, fields);
            }}
            leadingSlot={
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => guardedPush(`/admin/sales/${saleId}`)}
              >
                Cancel
              </Button>
            }
            submitSlot={
              <LoadingButton
                type="submit"
                loading={pending}
                loadingLabel="Saving…"
                className="min-h-11 w-full sm:min-w-40 sm:w-auto"
              >
                Save
              </LoadingButton>
            }
          >
            {(stepIndex) => {
              const stepIds = ["identity", "schedule", "documents", "review"] as const;
              const stepId = stepIds[stepIndex] ?? "identity";
              return (
                <div className="space-y-6">
                  <WizardStepIntro copy={saleFormStepIntro(stepId, "edit")} />
                  {stepIndex === 0 ? (
                    <SaleIdentityStep
                      form={form}
                      categories={categories}
                      pending={pending}
                      previewUrlByKey={previewUrlByKey}
                    />
                  ) : null}
                  {stepIndex === 1 ? (
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
                    />
                  ) : null}
                  {stepIndex === 2 ? (
                    <SaleDocumentsStep
                      form={form}
                      saleId={saleId}
                      initialSaleDocuments={initialSaleDocuments}
                      termsReadOnly={!isDraft}
                    />
                  ) : null}
                  {stepIndex === 3 ? (
                    <SaleFormReviewStep
                      form={form}
                      onEditStep={(index) => wizardGoToRef.current(index)}
                    />
                  ) : null}
                </div>
              );
            }}
          </AdminFormWizard>

          <FormRootErrorAlert message={form.formState.errors.root?.message ?? null} />
        </form>
      </Form>
    </>
  );
}
