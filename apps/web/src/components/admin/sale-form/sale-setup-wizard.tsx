"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { FormRootErrorAlert } from "@/components/admin/form-root-error-alert";
import { SALE_PUBLISH_PHRASE } from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { saleDetailReadinessDismissKey } from "@/lib/admin/compute-sale-detail-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import { parseSaleWindowFromForm, parseSaleWindowFromSale } from "@/lib/admin/sale-lot-window-sync";
import {
  SALE_SETUP_STEPS,
  type SaleSetupStepId,
  buildSaleSetupReadiness,
  catalogPrepReviewNotice,
  catalogueStaffReadOnlyMessage,
  isSaleSetupPublishReady,
  reviewPublishBlockedHint,
  saleSetupHref,
  saleSetupStepId,
  saveDraftSuccessMessage,
} from "@/lib/admin/sale-setup";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, EntityDocument, Lot, Sale, Venue } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { buildGoogleMapsSearchUrl, formatPostalAddress, isUkPostcode } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SaleLotRowsEditor } from "./sale-lot-rows-editor";
import { SaleSetupStepIntro } from "./sale-setup-step-intro";
import { SaleSetupCatalogPrepStep } from "./steps/catalog-prep-step";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleSetupReviewStep, isSaleSetupReadyToPublish } from "./steps/review-step";
import { SaleScheduleStep } from "./steps/schedule-step";
import {
  SALE_SETUP_STEP_FIELD_GROUPS,
  saleSetupStepLabel,
  saleSetupWizardValidationMessage,
  useSaleSetupSteps,
} from "./use-sale-setup-steps";
import { useSaleSetupSubmit } from "./use-sale-setup-submit";
import { useSaleTierBandPreview } from "./use-sale-tier-preview";

function WizardStepSync({
  stepIndex,
  onStepIndex,
}: {
  stepIndex: number;
  onStepIndex: (index: number) => void;
}) {
  useEffect(() => {
    onStepIndex(stepIndex);
  }, [onStepIndex, stepIndex]);
  return null;
}

type Props = {
  saleId: string | null;
  initialStep: SaleSetupStepId;
  defaultValues: AdminSaleFormValues;
  sale: Sale | null;
  lots: Lot[];
  categories: CategoryNode[];
  venues?: Venue[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked?: boolean;
  initialSaleDocuments?: EntityDocument[];
  previewUrlByKey?: Record<string, string>;
  wizardDraftEntityId?: string;
  canManageSale: boolean;
  canEditCatalog: boolean;
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId;
};

export function SaleSetupWizard({
  saleId: initialSaleId,
  initialStep,
  defaultValues,
  sale,
  lots,
  categories,
  venues = [],
  artists,
  englishOnlyAuctionsLocked = false,
  initialSaleDocuments = [],
  previewUrlByKey = {},
  wizardDraftEntityId,
  canManageSale,
  canEditCatalog,
  pendingRegistrationCount = null,
  connectRequiredByLotId,
}: Props) {
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const [pending, startTransition] = useTransition();
  const [saleId, setSaleId] = useState<string | null>(initialSaleId);
  const [lotsUnsaved, setLotsUnsaved] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [validationStepIndex, setValidationStepIndex] = useState<number | null>(null);
  const [showFirstSaveNudge, setShowFirstSaveNudge] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(() =>
    Math.max(
      0,
      SALE_SETUP_STEPS.findIndex((s) => s.id === initialStep),
    ),
  );
  const baselineRef = useRef(defaultValues);
  baselineRef.current = defaultValues;
  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(adminSaleDraftScheduleSchema()),
    defaultValues,
  });

  const getValuesRef = useRef(form.getValues);
  getValuesRef.current = form.getValues;

  const readOnlySaleSteps = !canManageSale;
  const canEditLotsStep = canManageSale || canEditCatalog;
  const readOnlyLots = !canEditLotsStep;
  const readOnlyCatalog = !canEditCatalog && !canManageSale;

  const { persistSale, handlePublish: runPublish } = useSaleSetupSubmit({
    form,
    saleId,
    setSaleId,
    lots,
    wizardDraftEntityId,
    wizardGoToRef,
    setStepNotice,
    setShowFirstSaveNudge,
  });
  const { jumpToStepIndex } = useSaleSetupSteps(wizardGoToRef);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buyerPremiumTiers",
  });

  const tierBandPreview = useSaleTierBandPreview(form);

  const deliveryMode = form.watch("deliveryMode");
  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");
  const isOnsite = deliveryMode === "onsite";
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

  const activeSale = sale;
  const pendingSaleWindow = useMemo(() => {
    const fromForm = parseSaleWindowFromForm({
      deliveryMode,
      startTime: watchedStartTime,
      endTime: watchedEndTime,
    });
    if (fromForm) return fromForm;
    return activeSale ? parseSaleWindowFromSale(activeSale) : null;
  }, [activeSale, deliveryMode, watchedEndTime, watchedStartTime]);
  const readyToPublish =
    saleId &&
    activeSale &&
    !form.formState.isDirty &&
    !lotsUnsaved &&
    isSaleSetupReadyToPublish(
      saleId,
      activeSale,
      lots,
      pendingRegistrationCount,
      connectRequiredByLotId,
    );
  const isReviewStep = saleSetupStepId(wizardStepIndex) === "review";
  const setupReadinessNudge =
    showFirstSaveNudge && saleId && activeSale && wizardStepIndex >= 1
      ? buildSaleSetupReadiness({
          saleId,
          sale: activeSale,
          lots,
          pendingRegistrationCount,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
          setupStepHref: (step) => saleSetupHref(saleId, step),
        })
      : null;

  const handleSaveDraft = useCallback(() => {
    startTransition(async () => {
      if (saleId && canManageSale && form.formState.isDirty) {
        const id = await persistSale({
          savedNoticeStep: isReviewStep ? "review" : saleSetupStepId(wizardStepIndex),
        });
        if (!id) return;
      }
      notify.success(saveDraftSuccessMessage());
      guardedPush(saleId ? `/admin/sales/${saleId}?created=1` : "/admin/sales");
    });
  }, [
    canManageSale,
    form.formState.isDirty,
    guardedPush,
    isReviewStep,
    persistSale,
    saleId,
    wizardStepIndex,
  ]);

  const mobilePrimaryAction = useMemo(() => {
    if (!isReviewStep) return null;
    if (!canManageSale) {
      return {
        label: "Back to sale",
        onClick: () => guardedPush(saleId ? `/admin/sales/${saleId}` : "/admin/sales"),
      };
    }
    return {
      label: "Publish sale",
      onClick: () => setPublishOpen(true),
      ...(!readyToPublish || pending ? { disabled: true as const } : {}),
    };
  }, [canManageSale, guardedPush, isReviewStep, pending, readyToPublish, saleId]);

  const mobileCancelAction = useMemo(() => {
    if (saleId) {
      return {
        label: isReviewStep ? "Save as draft" : "Save & finish later",
        onClick: handleSaveDraft,
      };
    }
    return { label: "Cancel", href: "/admin/sales" };
  }, [handleSaveDraft, isReviewStep, saleId]);

  const wizardCreateDraftExtras =
    !saleId && canManageSale
      ? {
          draft: {
            entityKind: "admin_sale_new",
            entityId: wizardDraftEntityId ?? "new",
            getValues: () => getValuesRef.current() as Record<string, unknown>,
          },
          onDraftResume: (payload: WizardDraftPayload) => {
            form.reset({
              ...baselineRef.current,
              ...(payload.values as Partial<AdminSaleFormValues>),
            });
          },
        }
      : {};

  useEffect(() => {
    const idx = SALE_SETUP_STEPS.findIndex((s) => s.id === initialStep);
    if (idx > 0) {
      wizardGoToRef.current(idx);
    }
  }, [initialStep]);

  const handleValidationBannerJump = useCallback(() => {
    if (validationStepIndex != null) jumpToStepIndex(validationStepIndex);
  }, [jumpToStepIndex, validationStepIndex]);

  const handlePublish = async () => {
    if (!saleId) return;
    await runPublish(saleId);
  };

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={CATALOG_FORM_IDS.saleSetup}
          className="space-y-8"
          onSubmit={(e) => e.preventDefault()}
        >
          {englishOnlyAuctionsLocked ? (
            <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
              English-only mode is on: lots in this sale must use the English auction type.
            </p>
          ) : null}

          {readOnlySaleSteps && canEditCatalog ? (
            <Alert>
              <AlertDescription>{catalogueStaffReadOnlyMessage()}</AlertDescription>
            </Alert>
          ) : null}

          {stepNotice ? (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertDescription className="text-on-surface">{stepNotice}</AlertDescription>
            </Alert>
          ) : null}

          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null
                ? {
                    stepLabel: saleSetupStepLabel(validationStepIndex),
                    onJumpToStep: handleValidationBannerJump,
                  }
                : {})}
            />
          ) : null}

          {setupReadinessNudge ? (
            <CatalogPublishReadiness
              title="Your sale draft is saved"
              readiness={setupReadinessNudge}
              {...(saleId ? { dismissKey: saleDetailReadinessDismissKey(saleId) } : {})}
            />
          ) : null}

          <AdminFormWizard
            steps={SALE_SETUP_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            hideStickyOnMobile
            mobilePrimaryAction={mobilePrimaryAction}
            mobileCancelAction={mobileCancelAction}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onStepBack={(toIndex) => {
              if (saleId) router.replace(saleSetupHref(saleId, saleSetupStepId(toIndex)));
            }}
            onBeforeNext={async (stepIndex) => {
              const stepId = saleSetupStepId(stepIndex);
              if (stepIndex <= 2) {
                if (readOnlySaleSteps) return stepIndex >= 3;
                const fields = SALE_SETUP_STEP_FIELD_GROUPS[stepIndex];
                if (
                  fields?.length &&
                  !(await validateWizardStep(form, adminSaleDraftScheduleSchema(), fields))
                ) {
                  setValidationStepIndex(stepIndex);
                  setValidationBanner(saleSetupWizardValidationMessage(stepIndex));
                  return false;
                }
                setValidationBanner(null);
                setValidationStepIndex(null);
                if (stepIndex === 1) {
                  let ok = false;
                  await new Promise<void>((resolve) => {
                    startTransition(async () => {
                      ok =
                        (await persistSale({
                          savedNoticeStep: "documents",
                          nextStep: "documents",
                        })) != null;
                      resolve();
                    });
                  });
                  return ok;
                }
                if (stepIndex === 2) {
                  let ok = false;
                  await new Promise<void>((resolve) => {
                    startTransition(async () => {
                      ok =
                        (await persistSale({
                          savedNoticeStep: "lots",
                          nextStep: "lots",
                        })) != null;
                      resolve();
                    });
                  });
                  return ok;
                }
                return true;
              }
              if (stepId === "lots") {
                if (readOnlyLots) return true;
                if (!saleId) {
                  notify.error("Save the sale first");
                  return false;
                }
                if (lotsUnsaved) {
                  notify.error("Save all lots before continuing");
                  return false;
                }
                if (lots.length === 0) {
                  notify.error("Add at least one lot");
                  return false;
                }
                router.replace(`/admin/sales/${saleId}/setup?step=catalog-prep`);
                return true;
              }
              if (stepId === "catalog-prep") {
                router.replace(`/admin/sales/${saleId}/setup?step=review`);
                if (
                  activeSale &&
                  !isSaleSetupPublishReady({
                    saleId: saleId as string,
                    sale: activeSale,
                    lots,
                    pendingRegistrationCount,
                    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
                  })
                ) {
                  setStepNotice(catalogPrepReviewNotice());
                }
                return true;
              }
              return true;
            }}
            leadingSlot={
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={handleSaveDraft}
              >
                {isReviewStep && saleId
                  ? "Save as draft"
                  : saleId
                    ? "Save & finish later"
                    : "Cancel"}
              </Button>
            }
            submitSlot={
              canManageSale ? (
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                  {!readyToPublish ? (
                    <p className="font-body text-xs text-on-surface-variant sm:text-right">
                      {reviewPublishBlockedHint()}
                    </p>
                  ) : null}
                  <LoadingButton
                    type="button"
                    loading={pending}
                    disabled={!readyToPublish}
                    data-wizard-submit="true"
                    className="min-h-11 w-full sm:min-w-40 sm:w-auto"
                    onClick={() => setPublishOpen(true)}
                  >
                    Publish sale
                  </LoadingButton>
                  <TypedConfirmationDialog
                    open={publishOpen}
                    onOpenChange={setPublishOpen}
                    title="Publish this sale?"
                    description="All lots will go live together according to the sale schedule. Confirm only when the catalog is complete."
                    actionLabel="Publish sale"
                    confirmationPhrase={SALE_PUBLISH_PHRASE}
                    severity="warning"
                    onConfirm={handlePublish}
                  />
                </div>
              ) : (
                <Button type="button" variant="outline" asChild className="min-h-11">
                  <Link href={saleId ? `/admin/sales/${saleId}` : "/admin/sales"}>
                    Back to sale
                  </Link>
                </Button>
              )
            }
            {...wizardCreateDraftExtras}
          >
            {(stepIndex) => {
              const stepId = saleSetupStepId(stepIndex);
              return (
                <div className="space-y-8">
                  <WizardStepSync stepIndex={stepIndex} onStepIndex={setWizardStepIndex} />
                  <SaleSetupStepIntro stepId={stepId} stepIndex={stepIndex} />
                  {stepIndex === 0 ? (
                    <fieldset disabled={readOnlySaleSteps}>
                      <SaleIdentityStep
                        form={form}
                        categories={categories}
                        pending={pending}
                        previewUrlByKey={previewUrlByKey}
                      />
                    </fieldset>
                  ) : null}
                  {stepIndex === 1 ? (
                    <fieldset disabled={readOnlySaleSteps}>
                      <SaleScheduleStep
                        form={form}
                        isDraft
                        isOnsite={isOnsite}
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
                        {...(saleId ? { lotsSetupHref: saleSetupHref(saleId, "lots") } : {})}
                      />
                    </fieldset>
                  ) : null}
                  {stepIndex === 2 && saleId ? (
                    <fieldset disabled={readOnlySaleSteps}>
                      <SaleDocumentsStep
                        form={form}
                        saleId={saleId}
                        initialSaleDocuments={initialSaleDocuments}
                      />
                    </fieldset>
                  ) : null}
                  {stepIndex === 3 && saleId && activeSale && pendingSaleWindow ? (
                    <SaleLotRowsEditor
                      saleId={saleId}
                      sale={{
                        deliveryMode: pendingSaleWindow.deliveryMode,
                        startTime: pendingSaleWindow.startTime,
                        endTime: pendingSaleWindow.endTime,
                      }}
                      lots={lots}
                      categories={categories}
                      artists={artists}
                      englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                      readOnly={readOnlyLots}
                      onLotsChange={() => router.refresh()}
                      onUnsavedChange={setLotsUnsaved}
                    />
                  ) : null}
                  {stepIndex === 4 && saleId && activeSale ? (
                    <SaleSetupCatalogPrepStep
                      saleId={saleId}
                      sale={activeSale}
                      lots={lots}
                      readOnly={readOnlyCatalog}
                      {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
                    />
                  ) : null}
                  {stepIndex === 5 && saleId && activeSale ? (
                    <SaleSetupReviewStep
                      saleId={saleId}
                      sale={activeSale}
                      lots={lots}
                      pendingRegistrationCount={pendingRegistrationCount}
                      canPublish={canManageSale}
                      onEditSummary={() => wizardGoToRef.current(0)}
                      {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
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
