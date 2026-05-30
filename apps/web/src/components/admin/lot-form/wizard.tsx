"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  clearWizardDraft,
  mergeWizardDraftValues,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { WizardStepIntro } from "@/components/admin/admin-form-wizard/wizard-step-intro";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { FormRootErrorAlert } from "@/components/admin/form-root-error-alert";
import {
  type LotEditSectionId,
  useLotEditSectionDirty,
} from "@/components/admin/lot-form/lot-edit-form-context";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { applyLotTypeFieldReset } from "@/lib/admin/lot-catalogue";
import { buildLotEditTabFields, buildLotStepFields } from "@/lib/admin/lot-form-field-ownership";
import { lotFormStepLabel } from "@/lib/admin/lot-form-field-ownership";
import { lotFormStepIntro } from "@/lib/admin/lot-form-step-copy";
import {
  type AdminLotFormSaleTiming,
  type AdminLotFormValues,
  buildAdminLotFormSchema,
} from "@/lib/forms/schemas/admin-lot-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import {
  type ArtistProfile,
  type CategoryNode,
  type LotAuctionType,
  type Sale,
  lotAuctionTypes,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useForm, useFormState } from "react-hook-form";
import { z as zod } from "zod";
import { LotCatalogueStep } from "./steps/catalogue-step";
import { LotIdentityStep } from "./steps/identity-step";
import { LotFormReviewStep } from "./steps/review-step";
import { LotSaleSellerStep } from "./steps/sale-seller-step";
import {
  reportLotFormValidationFailure,
  submitLotForm,
  validateAllLotWizardSteps,
} from "./use-lot-form-submit";

const LOT_FORM_STEPS = [
  { id: "identity", label: "Identity" },
  { id: "sale-seller", label: "Sale & seller" },
  { id: "catalogue", label: "Catalogue" },
  { id: "review", label: "Review" },
] as const;

const LOT_WIZARD_FIELD_STEPS = 3;

type SaleOption = Pick<Sale, "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime">;

type Props = {
  mode: "create" | "edit";
  lotId?: string;
  defaultValues: AdminLotFormValues;
  categories: CategoryNode[];
  /** Sales for the optional sale assignment picker. */
  sales?: SaleOption[];
  /** Pre-fetched canonical artists, used to resolve the selected chip when an
   * artistId is already attached. The picker still searches over the wire. */
  artists: ArtistProfile[];
  /** When true, only `english` is selectable unless the draft already uses a legacy type. */
  englishOnlyAuctionsLocked?: boolean;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
  /** Hide catalogue-step artist picker when attribution is handled elsewhere (e.g. lot edit). */
  showArtistField?: boolean;
  /** When set, dirty state is reported to {@link LotEditFormProvider} instead of a local guard. */
  lotEditSection?: LotEditSectionId;
};

export function AdminLotForm({
  mode,
  lotId,
  defaultValues,
  categories,
  sales = [],
  artists,
  englishOnlyAuctionsLocked = false,
  htmlFormId,
  showArtistField = true,
  lotEditSection,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const initialValuesRef = useRef(defaultValues);
  const baselineRef = useRef(defaultValues);
  baselineRef.current = defaultValues;
  const wizardGoToRef = useRef<(index: number) => void>(() => {});
  const tabGoToRef = useRef<(tabValue: string) => void>(() => {});
  tabGoToRef.current = (tabValue: string) => {
    const sectionId =
      tabValue === "overview"
        ? "lot-edit-identity"
        : tabValue === "sale"
          ? "lot-edit-sale"
          : "lot-edit-catalogue";
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [validationStepIndex, setValidationStepIndex] = useState<number | null>(null);
  const salesById = useMemo(() => {
    const map = new Map<string, AdminLotFormSaleTiming>();
    for (const s of sales) {
      map.set(s.id, {
        id: s.id,
        deliveryMode: s.deliveryMode,
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }
    return map;
  }, [sales]);
  const formSchema = useMemo(() => {
    const schema = buildAdminLotFormSchema(salesById);
    if (!englishOnlyAuctionsLocked) return schema;
    return schema.superRefine((data, ctx) => {
      if (mode === "create" && data.auctionType !== "english") {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "Only the English auction type is available while English-only mode is on.",
          path: ["auctionType"],
        });
      }
      if (
        mode === "edit" &&
        defaultValues.auctionType === "english" &&
        data.auctionType !== "english"
      ) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message: "This draft is English-only; you cannot switch it to another auction type.",
          path: ["auctionType"],
        });
      }
    });
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType, salesById]);

  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<AdminLotFormValues>({
    resolver,
    defaultValues: initialValuesRef.current,
    shouldUnregister: false,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
  const { isDirty } = useFormState({ control: form.control });
  useLotEditSectionDirty("auction", Boolean(lotEditSection === "auction" && isDirty));
  const auctionType = form.watch("auctionType");
  const lotStepFields = useMemo(
    () => buildLotStepFields(auctionType, { includeArtist: showArtistField }),
    [auctionType, showArtistField],
  );
  const editTabFields = useMemo(
    () => buildLotEditTabFields(auctionType, { includeArtist: showArtistField }),
    [auctionType, showArtistField],
  );

  const reportZodValidationFailure = useCallback(
    (issues: zod.ZodIssue[]) => {
      reportLotFormValidationFailure(form, issues, {
        mode,
        lotStepFields,
        editTabFields: editTabFields as Record<string, (keyof AdminLotFormValues)[]>,
        wizardGoTo: wizardGoToRef.current,
        tabGoTo: tabGoToRef.current,
        onValidationBanner: (message, stepIndex) => {
          setValidationBanner(message);
          setValidationStepIndex(stepIndex ?? null);
        },
      });
    },
    [editTabFields, form, lotStepFields, mode],
  );

  const handleValidationBannerJump = useCallback(() => {
    if (validationStepIndex != null) wizardGoToRef.current(validationStepIndex);
  }, [validationStepIndex]);

  const handleAuctionTypeChange = useCallback(
    (previous: LotAuctionType, next: LotAuctionType) => {
      if (previous !== next) {
        applyLotTypeFieldReset(form, previous, next);
      }
    },
    [form],
  );

  const handleEditLotType = useCallback(() => {
    wizardGoToRef.current(0);
  }, []);

  const getValuesRef = useRef(form.getValues);
  getValuesRef.current = form.getValues;
  const createIdempotencyKeyRef = useRef(`lot-create-${crypto.randomUUID()}`);

  const validateAllWizardSteps = useCallback(async () => {
    return validateAllLotWizardSteps(form, formSchema, lotStepFields, wizardGoToRef.current);
  }, [form, formSchema, lotStepFields]);

  const auctionTypeOptions = useMemo((): readonly LotAuctionType[] => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    if (mode === "create") return ["english"];
    if (defaultValues.auctionType !== "english") return lotAuctionTypes;
    return ["english"];
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType]);

  return (
    <>
      {!lotEditSection ? <FormDirtyGuard isDirty={isDirty} /> : null}
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit(
            async (values) => {
              setValidationBanner(null);
              setValidationStepIndex(null);
              if (mode === "create" && !(await validateAllWizardSteps())) {
                const parsed = await formSchema.safeParseAsync(form.getValues());
                if (!parsed.success) {
                  reportZodValidationFailure(parsed.error.issues);
                } else {
                  notifyAdminFormValidationFailure({});
                }
                return;
              }
              startTransition(async () => {
                await submitLotForm(values, {
                  mode,
                  lotId,
                  form,
                  formSchema,
                  lotStepFields,
                  editTabFields: editTabFields as Record<string, (keyof AdminLotFormValues)[]>,
                  wizardGoTo: (i) => wizardGoToRef.current(i),
                  tabGoTo: (t) => tabGoToRef.current(t),
                  createIdempotencyKey: createIdempotencyKeyRef.current,
                  clearDraft: () =>
                    clearWizardDraft(
                      wizardDraftCookieKey("lot", mode === "create" ? "new" : (lotId ?? "new")),
                    ),
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
                reportZodValidationFailure(parsed.error.issues);
                return;
              }
              if (mode === "create") {
                await validateAllWizardSteps();
              }
              notifyAdminFormValidationFailure({});
            },
          )}
        >
          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null
                ? {
                    stepLabel: lotFormStepLabel(validationStepIndex),
                    onJumpToStep: handleValidationBannerJump,
                  }
                : {})}
            />
          ) : null}
          {mode === "edit" ? (
            <div className="space-y-10">
              <section id="lot-edit-identity" className="scroll-mt-24 space-y-4">
                <h3 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                  Identity
                </h3>
                <LotIdentityStep
                  form={form}
                  auctionTypeOptions={auctionTypeOptions}
                  englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                />
              </section>
              <section id="lot-edit-sale" className="scroll-mt-24 space-y-4">
                <h3 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                  Sale & seller
                </h3>
                <LotSaleSellerStep form={form} sales={sales} />
              </section>
              <section id="lot-edit-catalogue" className="scroll-mt-24 space-y-4">
                <h3 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                  Catalogue
                </h3>
                <LotCatalogueStep
                  form={form}
                  categories={categories}
                  artists={artists}
                  sales={sales}
                  showArtistField={showArtistField}
                />
              </section>
            </div>
          ) : (
            <AdminFormWizard
              steps={LOT_FORM_STEPS}
              isDirty={isDirty}
              pending={pending}
              hideStickyOnMobile={Boolean(htmlFormId)}
              onStepControl={({ goTo }) => {
                wizardGoToRef.current = goTo;
              }}
              draft={{
                entityKind: "lot",
                entityId: "new",
                getValues: () => getValuesRef.current() as Record<string, unknown>,
              }}
              onDraftResume={(payload: WizardDraftPayload) => {
                form.reset(mergeWizardDraftValues(baselineRef.current, payload.values), {
                  keepDefaultValues: false,
                });
              }}
              onBeforeNext={async (stepIndex) => {
                if (stepIndex >= LOT_WIZARD_FIELD_STEPS) return true;
                const fields = lotStepFields[stepIndex];
                if (!fields?.length) return true;
                return validateWizardStep(form, formSchema, fields);
              }}
              leadingSlot={
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => guardedPush("/admin/lots")}
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
                  Create draft
                </LoadingButton>
              }
            >
              {(stepIndex) => {
                const stepIds = ["identity", "sale-seller", "catalogue", "review"] as const;
                const stepId = stepIds[stepIndex] ?? "identity";
                return (
                  <div className="space-y-6">
                    <WizardStepIntro
                      stepIndex={stepIndex}
                      stepCount={LOT_FORM_STEPS.length}
                      copy={lotFormStepIntro(stepId)}
                    />
                    {stepIndex === 0 ? (
                      <LotIdentityStep
                        form={form}
                        auctionTypeOptions={auctionTypeOptions}
                        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                        onAuctionTypeChange={handleAuctionTypeChange}
                      />
                    ) : null}
                    {stepIndex === 1 ? <LotSaleSellerStep form={form} sales={sales} /> : null}
                    {stepIndex === 2 ? (
                      <LotCatalogueStep
                        form={form}
                        categories={categories}
                        artists={artists}
                        sales={sales}
                        showArtistField={showArtistField}
                        onEditLotType={handleEditLotType}
                      />
                    ) : null}
                    {stepIndex === 3 ? (
                      <LotFormReviewStep
                        form={form}
                        onEditStep={(index) => wizardGoToRef.current(index)}
                      />
                    ) : null}
                  </div>
                );
              }}
            </AdminFormWizard>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {mode === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => guardedPush(lotId ? `/admin/lots/${lotId}` : "/admin/lots")}
                >
                  Cancel
                </Button>
                <LoadingButton type="submit" loading={pending} loadingLabel="Saving…">
                  Save changes
                </LoadingButton>
              </>
            ) : null}
          </div>

          <FormRootErrorAlert message={form.formState.errors.root?.message ?? null} />
        </form>
      </Form>
    </>
  );
}
