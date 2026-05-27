"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  clearWizardDraft,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { SALE_PUBLISH_PHRASE } from "@/components/admin/sale-actions/use-sale-lifecycle-actions";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import {
  adminCreateSaleResultAction,
  adminPublishSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import {
  findLotsOutsideSaleWindow,
  parseSaleWindowFromForm,
  parseSaleWindowFromSale,
} from "@/lib/admin/sale-lot-window-sync";
import {
  SALE_SETUP_SALE_STEP_FIELDS,
  SALE_SETUP_STEPS,
  type SaleSetupStepId,
  catalogPrepReviewNotice,
  catalogueStaffReadOnlyMessage,
  humanizeSetupError,
  isSaleSetupPublishReady,
  reviewPublishBlockedHint,
  saleSavedMessage,
  saleSetupHref,
  saleSetupStepId,
  saveDraftSuccessMessage,
  scheduleLotConflictPersistBlocked,
} from "@/lib/admin/sale-setup";
import {
  applyZodErrorsToForm,
  zodIssuePathForForm as zodPathJoin,
} from "@/lib/admin/zod-form-errors";
import {
  type AdminSaleFormValues,
  adminSaleDraftScheduleSchema,
  normalizeAdminFormTiersToApi,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, CategoryNode, EntityDocument, Lot, Sale } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import {
  buildBuyerPremiumPolicy,
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isUkPostcode,
} from "@auction/validators";
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

const SALE_STEP_FIELD_GROUPS: (keyof AdminSaleFormValues)[][] = [
  [...SALE_SETUP_SALE_STEP_FIELDS.identity],
  [...SALE_SETUP_SALE_STEP_FIELDS.schedule],
  [...SALE_SETUP_SALE_STEP_FIELDS.documents],
];

type Props = {
  saleId: string | null;
  initialStep: SaleSetupStepId;
  defaultValues: AdminSaleFormValues;
  sale: Sale | null;
  lots: Lot[];
  categories: CategoryNode[];
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

function saleZodIssuePath(path: (string | number)[]): string {
  if (path.length > 0 && typeof path[0] === "number") {
    return zodPathJoin(["buyerPremiumTiers", ...path]);
  }
  return zodPathJoin(path);
}

export function SaleSetupWizard({
  saleId: initialSaleId,
  initialStep,
  defaultValues,
  sale,
  lots,
  categories,
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
  const [wizardStepIndex, setWizardStepIndex] = useState(() =>
    Math.max(
      0,
      SALE_SETUP_STEPS.findIndex((s) => s.id === initialStep),
    ),
  );
  const baselineRef = useRef(defaultValues);
  baselineRef.current = defaultValues;
  const wizardGoToRef = useRef<(index: number) => void>(() => {});
  const createIdempotencyKeyRef = useRef(`sale-create-${crypto.randomUUID()}`);

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

  const persistSale = useCallback(
    async (opts?: { savedNoticeStep?: SaleSetupStepId }): Promise<string | null> => {
      const values = form.getValues();
      if (!saleId) {
        const api = safeParseCreateSaleFromForm(values);
        if (!api.success) {
          for (const iss of api.error.issues) {
            applyZodErrorsToForm(form, saleZodIssuePath([...iss.path]), iss.message);
          }
          notify.error("Check the form for errors");
          return null;
        }
        const r = await adminCreateSaleResultAction(api.data, createIdempotencyKeyRef.current);
        if (!r.ok) {
          notify.error(
            humanizeSetupError({
              message: actionFailureNotifyMessage(r.error, {
                status: r.status,
                errorCode: r.errorCode,
                meta: r.meta,
              }),
              errorCode: r.errorCode,
            }),
          );
          return null;
        }
        clearWizardDraft(wizardDraftCookieKey("admin_sale_new", wizardDraftEntityId ?? "new"));
        if (!r.data?.id) return null;
        const newId = r.data.id;
        setSaleId(newId);
        router.replace(`/admin/sales/${newId}/setup?step=schedule`);
        setStepNotice(saleSavedMessage("schedule"));
        return newId;
      }

      const api = safeParseUpdateSaleFromForm(values);
      if (!api.success) {
        for (const iss of api.error.issues) {
          applyZodErrorsToForm(form, saleZodIssuePath([...iss.path]), iss.message);
        }
        notify.error("Check the form for errors");
        return null;
      }
      const pendingWindow = parseSaleWindowFromForm(values);
      if (pendingWindow && lots.length > 0) {
        const conflicts = findLotsOutsideSaleWindow(lots, pendingWindow);
        if (conflicts.length > 0) {
          const titles = conflicts.map((c) => c.lot.title.trim() || "Untitled lot");
          setStepNotice(scheduleLotConflictPersistBlocked(titles));
          wizardGoToRef.current(1);
          return null;
        }
      }
      const r = await adminUpdateSaleResultAction(saleId, api.data);
      if (!r.ok) {
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error, {
              status: r.status,
              errorCode: r.errorCode,
              meta: r.meta,
            }),
            errorCode: r.errorCode,
          }),
        );
        return null;
      }
      setStepNotice(saleSavedMessage(opts?.savedNoticeStep ?? "lots"));
      router.refresh();
      return saleId;
    },
    [form, lots, router, saleId, wizardDraftEntityId],
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buyerPremiumTiers",
  });

  const tierRowsWatch = form.watch("buyerPremiumTiers");
  const buyerPremiumRateWatch = form.watch("buyerPremiumRate");
  const tierBandPreview = useMemo(() => {
    const parsed = normalizeAdminFormTiersToApi(tierRowsWatch);
    if (!parsed.ok) return { ok: false as const };
    const policy = buildBuyerPremiumPolicy({
      saleTiers: parsed.data,
      lotRate: buyerPremiumRateWatch.trim() || "0.25",
    });
    const exLow = "250000";
    const exHigh = "600000";
    const kind = parsed.data && parsed.data.length > 0 ? ("tiered" as const) : ("flat" as const);
    return {
      ok: true as const,
      kind,
      at250k: { hammer: exLow, premium: policy.computePremiumMajor(exLow) },
      at600k: { hammer: exHigh, premium: policy.computePremiumMajor(exHigh) },
    };
  }, [tierRowsWatch, buyerPremiumRateWatch]);

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

  const handleSaveDraft = useCallback(() => {
    startTransition(async () => {
      if (saleId && canManageSale && form.formState.isDirty) {
        const id = await persistSale({
          savedNoticeStep: isReviewStep ? "review" : saleSetupStepId(wizardStepIndex),
        });
        if (!id) return;
      }
      notify.success(saveDraftSuccessMessage());
      guardedPush(saleId ? `/admin/sales/${saleId}` : "/admin/sales");
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
    if (form.formState.isDirty) {
      const id = await persistSale({ savedNoticeStep: "review" });
      if (!id) return;
    }
    const r = await adminPublishSaleResultAction(saleId);
    if (!r.ok) {
      notify.error(
        humanizeSetupError({
          message: actionFailureNotifyMessage(r.error, {
            status: r.status,
            errorCode: r.errorCode,
            meta: r.meta,
          }),
          errorCode: r.errorCode,
        }),
      );
      return;
    }
    notify.success("Sale published");
    router.push(`/admin/sales/${saleId}`);
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

          <AdminFormWizard
            steps={SALE_SETUP_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            hideStickyOnMobile
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={async (stepIndex) => {
              const stepId = saleSetupStepId(stepIndex);
              if (stepIndex <= 2) {
                if (readOnlySaleSteps) return stepIndex >= 3;
                const fields = SALE_STEP_FIELD_GROUPS[stepIndex];
                if (
                  fields?.length &&
                  !(await validateWizardStep(form, adminSaleDraftScheduleSchema(), fields))
                ) {
                  return false;
                }
                if (stepIndex === 1) {
                  let ok = false;
                  await new Promise<void>((resolve) => {
                    startTransition(async () => {
                      ok = (await persistSale({ savedNoticeStep: "documents" })) != null;
                      resolve();
                    });
                  });
                  return ok;
                }
                if (stepIndex === 2) {
                  if (!saleId) {
                    let ok = false;
                    await new Promise<void>((resolve) => {
                      startTransition(async () => {
                        ok = (await persistSale({ savedNoticeStep: "lots" })) != null;
                        resolve();
                      });
                    });
                    if (!ok) return false;
                  } else {
                    let ok = false;
                    await new Promise<void>((resolve) => {
                      startTransition(async () => {
                        ok = (await persistSale({ savedNoticeStep: "lots" })) != null;
                        resolve();
                      });
                    });
                    return ok;
                  }
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
                        {...(saleId ? { lotsSetupHref: saleSetupHref(saleId, "lots") } : {})}
                      />
                    </fieldset>
                  ) : null}
                  {stepIndex === 2 ? (
                    <fieldset disabled={readOnlySaleSteps}>
                      <SaleDocumentsStep
                        form={form}
                        mode={saleId ? "edit" : "create"}
                        initialSaleDocuments={initialSaleDocuments}
                        {...(saleId ? { saleId } : {})}
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
                      {...(connectRequiredByLotId ? { connectRequiredByLotId } : {})}
                    />
                  ) : null}
                </div>
              );
            }}
          </AdminFormWizard>
        </form>
      </Form>
    </>
  );
}
