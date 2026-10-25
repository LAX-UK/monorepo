"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  clearWizardDraft,
  mergeWizardDraftValues,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { WizardStepIntro } from "@/components/admin/admin-form-wizard/wizard-step-intro";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { staffFormSummaryErrors } from "@/components/admin/forms/staff-form-fields";
import {
  LotEditDirtyReporter,
  type LotEditSectionId,
} from "@/components/admin/lot-form/lot-edit-form-context";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { applyLotTypeFieldReset } from "@/lib/admin/lot-catalogue";
import { buildLotEditTabFields, buildLotStepFields } from "@/lib/admin/lot-form-field-ownership";
import { lotFormStepIntro } from "@/lib/admin/lot-form-step-copy";
import { buildLotSetupStepperViewModel } from "@/lib/data/view-models/lot-setup-stepper.vm";
import {
  type AdminLotFormSaleTiming,
  type AdminLotFormValues,
  buildAdminLotFormSchema,
} from "@/lib/forms/schemas/admin-lot-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { FormActions, FormErrorSummary, Notice, StaffButton } from "@auction/staff-ui";
import {
  type ArtistProfile,
  type CategoryNode,
  type LotAuctionType,
  type Sale,
  lotAuctionTypes,
} from "@auction/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z as zod } from "zod";
import { LOT_FORM_ID } from "./lot-field-spec";
import { LotCatalogueStep } from "./steps/catalogue-step";
import { LotIdentityStep } from "./steps/identity-step";
import { LotFormReviewStep } from "./steps/review-step";
import { LotSaleSellerStep } from "./steps/sale-seller-step";
import {
  reportLotFormValidationFailure,
  submitLotForm,
  validateAllLotWizardSteps,
} from "./use-lot-form-submit";

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
  /** When set, create flow targets a live/scheduled sale (copy + submit behaviour). */
  emergencyAddSaleStatus?: "scheduled" | "active" | null;
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
  emergencyAddSaleStatus = null,
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
    document.getElementById(sectionId)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  const [formDirty, setFormDirty] = useState(false);
  /** Each failed submit or Continue, so the error summary takes focus only then. */
  const [failedAttempts, setFailedAttempts] = useState(0);
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
    // Errors appear on submit (or Continue), then clear as each field is fixed.
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The error summary takes focus on a failed submit and links to each field.
    shouldFocusError: false,
  });
  const auctionType = form.watch("auctionType");
  const wizardSteps = useMemo(() => buildLotSetupStepperViewModel(mode), [mode]);
  const lotStepFields = useMemo(
    () => buildLotStepFields(auctionType, { includeArtist: showArtistField }),
    [auctionType, showArtistField],
  );
  const editTabFields = useMemo(
    () => buildLotEditTabFields(auctionType, { includeArtist: showArtistField }),
    [auctionType, showArtistField],
  );

  const summaryOrder = useMemo(() => lotStepFields.flat().map(String), [lotStepFields]);

  const reportZodValidationFailure = useCallback(
    (issues: zod.ZodIssue[]) => {
      reportLotFormValidationFailure(form, issues, {
        mode,
        lotStepFields,
        editTabFields: editTabFields as Record<string, (keyof AdminLotFormValues)[]>,
        wizardGoTo: wizardGoToRef.current,
        tabGoTo: tabGoToRef.current,
        // The error summary lists what to fix; the step with the first error is shown.
        onValidationBanner: () => {},
      });
    },
    [editTabFields, form, lotStepFields, mode],
  );

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
      {!lotEditSection ? <FormDirtyGuard isDirty={formDirty} /> : null}
      <>
        <LotEditDirtyReporter
          control={form.control}
          {...(lotEditSection ? { lotEditSection } : {})}
          {...(!lotEditSection ? { onWizardDirtyChange: setFormDirty } : {})}
        />
        <form
          id={htmlFormId}
          noValidate
          className="flex flex-col gap-6"
          onSubmit={form.handleSubmit(
            async (values) => {
              if (mode === "create" && !(await validateAllWizardSteps())) {
                const parsed = await formSchema.safeParseAsync(form.getValues());
                if (!parsed.success) reportZodValidationFailure(parsed.error.issues);
                setFailedAttempts((count) => count + 1);
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
                  onValidationBanner: () => {},
                  router,
                  emergencyAddSaleStatus,
                });
              });
            },
            async () => {
              setFailedAttempts((count) => count + 1);
              const parsed = await formSchema.safeParseAsync(form.getValues());
              if (!parsed.success) {
                reportZodValidationFailure(parsed.error.issues);
                return;
              }
              if (mode === "create") {
                await validateAllWizardSteps();
              }
            },
          )}
        >
          <FormErrorSummary
            errors={staffFormSummaryErrors(form.formState.errors, LOT_FORM_ID, summaryOrder)}
            focusKey={failedAttempts}
          />
          {form.formState.errors.root?.message ? (
            <Notice tone="danger" alert title="The lot was not saved">
              {form.formState.errors.root.message}
            </Notice>
          ) : null}
          {mode === "edit" ? (
            <div className="flex flex-col gap-6">
              <div id="lot-edit-identity" className="scroll-mt-24">
                <LotIdentityStep
                  form={form}
                  auctionTypeOptions={auctionTypeOptions}
                  englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                />
              </div>
              <div id="lot-edit-sale" className="scroll-mt-24">
                <LotSaleSellerStep form={form} sales={sales} />
              </div>
              <div id="lot-edit-catalogue" className="scroll-mt-24">
                <LotCatalogueStep
                  form={form}
                  categories={categories}
                  artists={artists}
                  sales={sales}
                  showArtistField={showArtistField}
                />
              </div>
            </div>
          ) : (
            <AdminFormWizard
              steps={wizardSteps}
              layout="sidebar"
              isDirty={formDirty}
              pending={pending}
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
                const ok = await validateWizardStep(form, formSchema, fields, { focus: false });
                if (!ok) setFailedAttempts((count) => count + 1);
                return ok;
              }}
              leadingSlot={
                <StaffButton
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => guardedPush("/admin/lots")}
                >
                  Cancel
                </StaffButton>
              }
              submitSlot={
                <StaffButton type="submit" variant="primary" loading={pending}>
                  {emergencyAddSaleStatus ? "Add lot to sale" : "Create draft"}
                </StaffButton>
              }
            >
              {(stepIndex) => {
                const stepIds = ["identity", "sale-seller", "catalogue", "review"] as const;
                const stepId = stepIds[stepIndex] ?? "identity";
                return (
                  <div className="flex flex-col gap-6">
                    <WizardStepIntro copy={lotFormStepIntro(stepId)} />
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
                        sales={sales}
                        categories={categories}
                        onEditStep={(index) => wizardGoToRef.current(index)}
                      />
                    ) : null}
                  </div>
                );
              }}
            </AdminFormWizard>
          )}

          {mode === "edit" ? (
            <FormActions
              sticky
              start={
                <StaffButton
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => guardedPush(lotId ? `/admin/lots/${lotId}` : "/admin/lots")}
                >
                  Cancel
                </StaffButton>
              }
            >
              <StaffButton type="submit" variant="primary" loading={pending}>
                Save changes
              </StaffButton>
            </FormActions>
          ) : null}
        </form>
      </>
    </>
  );
}
