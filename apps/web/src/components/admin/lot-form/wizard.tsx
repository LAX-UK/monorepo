"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  clearWizardDraft,
  mergeWizardDraftValues,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import {
  type LotEditSectionId,
  useLotEditSectionDirty,
} from "@/components/admin/lot-form/lot-edit-form-context";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import {
  adminCreateLotResultAction,
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import { applyLotTypeFieldReset } from "@/lib/admin/lot-catalogue";
import {
  buildLotEditTabFields,
  buildLotStepFields,
  lotFormStepLabel,
  lotFormValidationBanner,
} from "@/lib/admin/lot-form-field-ownership";
import { notifyLotFormValidationFailure } from "@/lib/admin/lot-form-validation-notify";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import {
  type AdminLotFormSaleTiming,
  type AdminLotFormValues,
  buildAdminLotFormSchema,
  formValuesToImageAltsPatch,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "@/lib/forms/schemas/admin-lot-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
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
import { LotSaleSellerStep } from "./steps/sale-seller-step";

const LOT_FORM_STEPS = [
  { id: "identity", label: "Identity" },
  { id: "sale-seller", label: "Sale & seller" },
  { id: "catalogue", label: "Catalogue" },
] as const;

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
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
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
      if (mode === "create") {
        applyZodIssuesToForm(form, issues, {
          stepFields: lotStepFields,
          goTo: wizardGoToRef.current,
        });
        const stepIndex = issues[0]?.path[0]
          ? lotStepFields.findIndex((fields) =>
              fields.some((f) => String(f) === String(issues[0]?.path[0])),
            )
          : -1;
        if (issues.length > 1 && stepIndex >= 0) {
          setValidationBanner(lotFormValidationBanner(issues.length, lotFormStepLabel(stepIndex)));
        } else {
          setValidationBanner(null);
        }
      } else {
        applyZodIssuesToForm(form, issues, {
          tabFields: editTabFields,
          goToTab: tabGoToRef.current,
        });
        setValidationBanner(null);
      }
      notifyLotFormValidationFailure({ issues });
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
    for (let i = 0; i < lotStepFields.length; i++) {
      const fields = lotStepFields[i];
      if (fields?.length && !(await validateWizardStep(form, formSchema, fields))) {
        wizardGoToRef.current(i);
        return false;
      }
    }
    return true;
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
              if (mode === "create" && !(await validateAllWizardSteps())) {
                const parsed = await formSchema.safeParseAsync(form.getValues());
                if (!parsed.success) {
                  reportZodValidationFailure(parsed.error.issues);
                } else {
                  notifyLotFormValidationFailure({});
                }
                return;
              }
              startTransition(async () => {
                form.clearErrors("root");
                if (mode === "create") {
                  const api = safeParseCreateLotFromForm(values);
                  if (!api.success) {
                    reportZodValidationFailure(api.error.issues);
                    return;
                  }
                  const r = await adminCreateLotResultAction(
                    api.data,
                    createIdempotencyKeyRef.current,
                  );
                  if (r.ok) {
                    clearWizardDraft(wizardDraftCookieKey("lot", "new"));
                    const newId = r.data?.id;
                    if (newId) {
                      const alts = await adminUpdateLotMarketingDetailsResultAction(
                        newId,
                        formValuesToImageAltsPatch(values),
                      );
                      if (!alts.ok) {
                        notify.warning("Draft created, but image alt text could not be saved", {
                          description: alts.error,
                        });
                      }
                    }
                    notify.success("Draft created");
                    if (newId) {
                      router.push(`/admin/lots/${newId}`);
                    } else {
                      notify.warning(
                        "Draft created but id was missing — open it from the lots list.",
                      );
                      router.push("/admin/lots");
                    }
                    return;
                  }
                  notify.error(
                    actionFailureNotifyMessage(r.error, {
                      status: r.status,
                      errorCode: r.errorCode,
                      meta: r.meta,
                    }),
                  );
                  return;
                }
                if (!lotId) {
                  notify.error("Missing lot");
                  return;
                }
                const api = safeParseUpdateLotFromForm(values);
                if (!api.success) {
                  reportZodValidationFailure(api.error.issues);
                  return;
                }
                const r = await adminUpdateLotResultAction(lotId, api.data);
                if (r.ok) {
                  if (lotId) clearWizardDraft(wizardDraftCookieKey("lot", lotId));
                  const alts = await adminUpdateLotMarketingDetailsResultAction(
                    lotId,
                    formValuesToImageAltsPatch(values),
                  );
                  if (!alts.ok) {
                    notify.warning("Lot saved, but image alt text could not be saved", {
                      description: alts.error,
                    });
                  } else {
                    notify.success("Saved");
                  }
                  router.refresh();
                  router.push(`/admin/lots/${lotId}`);
                  return;
                }
                notify.error(
                  actionFailureNotifyMessage(r.error, {
                    status: r.status,
                    errorCode: r.errorCode,
                    meta: r.meta,
                  }),
                );
              });
            },
            async () => {
              setValidationBanner(null);
              const parsed = await formSchema.safeParseAsync(form.getValues());
              if (!parsed.success) {
                reportZodValidationFailure(parsed.error.issues);
                return;
              }
              if (mode === "create") {
                await validateAllWizardSteps();
              }
              notifyLotFormValidationFailure({});
            },
          )}
        >
          {validationBanner ? (
            <p className="font-body text-sm text-error" role="alert">
              {validationBanner}
            </p>
          ) : null}
          {mode === "edit" ? (
            <AdminDetailTabs
              defaultValue="overview"
              onTabControl={({ goTo }) => {
                tabGoToRef.current = goTo;
              }}
              tabs={[
                {
                  value: "overview",
                  label: "Overview",
                  content: (
                    <LotIdentityStep
                      form={form}
                      auctionTypeOptions={auctionTypeOptions}
                      englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
                    />
                  ),
                },
                {
                  value: "sale",
                  label: "Sale & seller",
                  content: <LotSaleSellerStep form={form} sales={sales} />,
                },
                {
                  value: "catalogue",
                  label: "Catalogue",
                  content: (
                    <LotCatalogueStep
                      form={form}
                      categories={categories}
                      artists={artists}
                      showArtistField={showArtistField}
                    />
                  ),
                },
              ]}
            />
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
              {(stepIndex) => (
                <>
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
                      showArtistField={showArtistField}
                      onEditLotType={handleEditLotType}
                    />
                  ) : null}
                </>
              )}
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

          {form.formState.errors.root ? (
            <p className="text-sm text-error" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}
        </form>
      </Form>
    </>
  );
}
