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
import {
  SALE_SETUP_STEPS,
  type SaleSetupStepId,
  catalogueStaffReadOnlyMessage,
  isSaleSetupPublishReady,
  resolveSaleSetupStepTransition,
  reviewPublishBlockedHint,
  saleSetupHref,
  saleSetupStepId,
} from "@/lib/admin/sale-setup";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, EntityDocument, Lot, Sale, Venue } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SaleLotRowsEditor } from "./sale-lot-rows-editor";
import { SaleSetupStepIntro } from "./sale-setup-step-intro";
import { SaleSetupCatalogPrepStep } from "./steps/catalog-prep-step";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleSetupReviewStep } from "./steps/review-step";
import { SaleScheduleStep } from "./steps/schedule-step";
import {
  SALE_SETUP_STEP_FIELD_GROUPS,
  saleSetupStepLabel,
  saleSetupWizardValidationMessage,
  useSaleSetupSteps,
} from "./use-sale-setup-steps";
import { useSaleSetupSubmit } from "./use-sale-setup-submit";
import { useSaleSetupWizardView } from "./use-sale-setup-wizard-view";
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

  const {
    isSaleroom,
    formattedPreviewAddress,
    previewMapUrl,
    customMapUrl,
    postcodeIsValid,
    pendingSaleWindow,
    readyToPublish,
    isReviewStep,
    setupReadinessNudge,
    handleSaveDraft,
    mobilePrimaryAction,
    mobileCancelAction,
  } = useSaleSetupWizardView({
    form,
    sale,
    saleId,
    lots,
    lotsUnsaved,
    wizardStepIndex,
    showFirstSaveNudge,
    pendingRegistrationCount,
    connectRequiredByLotId,
    canManageSale,
    pending,
    guardedPush,
    persistSale,
    startTransition,
    onPublishOpen: () => setPublishOpen(true),
  });

  const activeSale = sale;

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

  const executeStepTransition = useCallback(
    async (stepIndex: number): Promise<boolean> => {
      const stepId = saleSetupStepId(stepIndex);

      if (stepIndex <= 2 && !readOnlySaleSteps) {
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
      }

      const catalogPrepShowReadinessNotice = Boolean(
        activeSale &&
          saleId &&
          !isSaleSetupPublishReady({
            saleId,
            sale: activeSale,
            lots,
            pendingRegistrationCount,
            ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
          }),
      );

      const result = resolveSaleSetupStepTransition({
        stepIndex,
        stepId,
        readOnlySaleSteps,
        readOnlyLots,
        saleId,
        lotsUnsaved,
        lotsCount: lots.length,
        catalogPrepShowReadinessNotice,
        catalogPrepHref: saleId ? `/admin/sales/${saleId}/setup?step=catalog-prep` : "/admin/sales",
        reviewHref: saleId ? `/admin/sales/${saleId}/setup?step=review` : "/admin/sales",
      });

      switch (result.action) {
        case "readonly-skip":
          return stepIndex >= result.allowWhenStepIndexGte;
        case "block":
          if (result.notifyMessage) notify.error(result.notifyMessage);
          return false;
        case "persist": {
          let ok = false;
          await new Promise<void>((resolve) => {
            startTransition(async () => {
              ok =
                (await persistSale({
                  savedNoticeStep: result.savedNoticeStep,
                  nextStep: result.nextStep,
                })) != null;
              resolve();
            });
          });
          return ok;
        }
        case "navigate":
          router.replace(result.href);
          if (result.notice) setStepNotice(result.notice);
          return true;
        case "advance":
          return true;
        default: {
          const _exhaustive: never = result;
          return _exhaustive;
        }
      }
    },
    [
      activeSale,
      connectRequiredByLotId,
      form,
      lots,
      lotsUnsaved,
      pendingRegistrationCount,
      persistSale,
      readOnlyLots,
      readOnlySaleSteps,
      router,
      saleId,
    ],
  );

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
            onBeforeNext={executeStepTransition}
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
                    ? WIZARD_COPY.finishLater
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
