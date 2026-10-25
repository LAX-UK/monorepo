"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { staffFormSummaryErrors } from "@/components/admin/forms/staff-form-fields";
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
import { buildSaleSetupStepperSteps } from "@/lib/data/view-models/sale-setup-stepper.vm";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { WIZARD_COPY } from "@/lib/forms/wizard-copy";
import { ConfirmActionDialog, FormErrorSummary, Notice, StaffButton } from "@auction/staff-ui";
import type { ArtistProfile, CategoryNode, EntityDocument, Lot, Sale, Venue } from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SALE_FORM_ID } from "./sale-form-id";
import { SaleLotRowsEditor } from "./sale-lot-rows-editor";
import { SaleSetupStepIntro } from "./sale-setup-step-intro";
import { SaleSetupCatalogPrepStep } from "./steps/catalog-prep-step";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleSetupReviewStep } from "./steps/review-step";
import { SaleScheduleStep } from "./steps/schedule-step";
import { SALE_SETUP_STEP_FIELD_GROUPS } from "./use-sale-setup-steps";
import { useSaleSetupSubmit } from "./use-sale-setup-submit";
import { useSaleSetupWizardView } from "./use-sale-setup-wizard-view";
import { useSaleTierBandPreview } from "./use-sale-tier-preview";

const SUMMARY_ORDER = SALE_SETUP_STEP_FIELD_GROUPS.flat().map(String);

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
    // Each step is checked on Continue, then its fields again as they change.
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });
  /** Each failed Continue, so the error summary takes focus only then. */
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);

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
          !(await validateWizardStep(form, adminSaleDraftScheduleSchema(), fields, {
            focus: false,
          }))
        ) {
          setFailedAttempts((count) => count + 1);
          return false;
        }
      }
      setBlockNotice(null);

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
          if (result.notifyMessage) setBlockNotice(result.notifyMessage);
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
      <form
        id={CATALOG_FORM_IDS.saleSetup}
        noValidate
        aria-label="Sale setup"
        className="flex flex-col gap-6"
        onSubmit={(e) => e.preventDefault()}
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
        {blockNotice ? (
          <Notice tone="warning" alert title="This step cannot be finished yet">
            {blockNotice}
          </Notice>
        ) : null}
        {readOnlySaleSteps && canEditCatalog ? (
          <Notice tone="info" title="You can edit the lots and catalogue only">
            {catalogueStaffReadOnlyMessage()}
          </Notice>
        ) : null}
        {stepNotice ? <Notice tone="info" title={stepNotice} /> : null}
        {setupReadinessNudge ? (
          <CatalogPublishReadiness
            title="Your sale draft is saved"
            readiness={setupReadinessNudge}
            {...(saleId ? { dismissKey: saleDetailReadinessDismissKey(saleId) } : {})}
          />
        ) : null}

        <AdminFormWizard
          steps={buildSaleSetupStepperSteps()}
          layout="sidebar"
          isDirty={form.formState.isDirty}
          pending={pending}
          stickyActions={false}
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
            <StaffButton type="button" variant="ghost" disabled={pending} onClick={handleSaveDraft}>
              {isReviewStep && saleId
                ? "Save as draft"
                : saleId
                  ? WIZARD_COPY.finishLater
                  : "Cancel"}
            </StaffButton>
          }
          submitSlot={
            canManageSale ? (
              <StaffButton
                type="button"
                variant="primary"
                loading={pending}
                data-wizard-submit="true"
                {...(readyToPublish ? {} : { disabledReason: reviewPublishBlockedHint() })}
                onClick={() => setPublishOpen(true)}
              >
                Publish sale
              </StaffButton>
            ) : (
              <StaffButton asChild variant="secondary">
                <Link href={saleId ? `/admin/sales/${saleId}` : "/admin/sales"}>Back to sale</Link>
              </StaffButton>
            )
          }
          {...wizardCreateDraftExtras}
        >
          {(stepIndex) => {
            const stepId = saleSetupStepId(stepIndex);
            return (
              <div className="flex flex-col gap-6">
                <WizardStepSync stepIndex={stepIndex} onStepIndex={setWizardStepIndex} />
                <div className="lg:hidden">
                  <SaleSetupStepIntro stepId={stepId} stepIndex={stepIndex} />
                </div>
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
                    documentCount={initialSaleDocuments.length}
                    onEditSummary={() => wizardGoToRef.current(0)}
                    {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
                  />
                ) : null}
              </div>
            );
          }}
        </AdminFormWizard>
      </form>
      <ConfirmActionDialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!pending) setPublishOpen(open);
        }}
        title={`Publish ${form.getValues("title")?.trim() || "this sale"}?`}
        description="The sale and all its lots go on the site together, on the sale's schedule. Registrations open as set in the sale."
        confirmLabel="Publish sale"
        loading={pending}
        onConfirm={() => {
          startTransition(async () => {
            await handlePublish();
            setPublishOpen(false);
          });
        }}
      />
    </>
  );
}
