"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import {
  clearWizardDraft,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import {
  adminCreateSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  applyZodErrorsToForm,
  zodIssuePathForForm as zodPathJoin,
} from "@/lib/admin/zod-form-errors";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import {
  type AdminSaleFormValues,
  adminSaleFormValuesSchema,
  normalizeAdminFormTiersToApi,
  safeParseCreateSaleFromForm,
  safeParseUpdatePublishedSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { CategoryNode, EntityDocument } from "@auction/types";
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
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { SaleDocumentsStep } from "./steps/documents-step";
import { SaleIdentityStep } from "./steps/identity-step";
import { SaleScheduleStep } from "./steps/schedule-step";

const SALE_FORM_STEPS = [
  { id: "identity", label: "Identity" },
  { id: "schedule", label: "Schedule" },
  { id: "documents", label: "Documents" },
] as const;

const SALE_STEP_FIELDS: (keyof AdminSaleFormValues)[][] = [
  ["title", "description", "coverImages", "categoryId"],
  [
    "deliveryMode",
    "startTime",
    "endTime",
    "previewStartTime",
    "streamUrl",
    "locationName",
    "locationPostcode",
    "buyerPremiumRate",
    "buyerPremiumTiers",
  ],
  ["terms"],
];

type Props = {
  mode: "create" | "edit";
  saleId?: string;
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
  /** Isolate wizard draft autosave cookie per flow (e.g. clone-from-sale id). Create mode only. */
  wizardDraftEntityId?: string;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
};

function saleZodIssuePath(path: (string | number)[]): string {
  if (path.length > 0 && typeof path[0] === "number") {
    return zodPathJoin(["buyerPremiumTiers", ...path]);
  }
  return zodPathJoin(path);
}

export function AdminSaleForm({
  mode,
  saleId,
  saleStatus,
  defaultValues,
  categories,
  englishOnlyAuctionsLocked = false,
  initialSaleDocuments = [],
  previewUrlByKey = {},
  wizardDraftEntityId,
  htmlFormId,
}: Props) {
  const isDraft = mode === "create" || !saleStatus || saleStatus === "draft";
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const baselineRef = useRef(defaultValues);
  baselineRef.current = defaultValues;
  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(adminSaleFormValuesSchema),
    defaultValues,
  });
  const getValuesRef = useRef(form.getValues);
  getValuesRef.current = form.getValues;
  const createIdempotencyKeyRef = useRef(`sale-create-${crypto.randomUUID()}`);

  const validateAllWizardSteps = useCallback(async () => {
    for (let i = 0; i < SALE_STEP_FIELDS.length; i++) {
      const fields = SALE_STEP_FIELDS[i];
      if (fields?.length && !(await validateWizardStep(form, adminSaleFormValuesSchema, fields))) {
        wizardGoToRef.current(i);
        return false;
      }
    }
    return true;
  }, [form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buyerPremiumTiers",
  });

  const tierRowsWatch = form.watch("buyerPremiumTiers");
  const buyerPremiumRateWatch = form.watch("buyerPremiumRate");
  const tierBandPreview = useMemo(() => {
    const parsed = normalizeAdminFormTiersToApi(tierRowsWatch);
    if (!parsed.ok) {
      return { ok: false as const };
    }
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

  const wizardCreateDraftExtras =
    mode === "create"
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

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit(async (values) => {
            if (!(await validateAllWizardSteps())) {
              notify.error("Check the form for errors");
              return;
            }
            startTransition(async () => {
              form.clearErrors("root");
              if (mode === "create") {
                const api = safeParseCreateSaleFromForm(values);
                if (!api.success) {
                  for (const iss of api.error.issues) {
                    applyZodErrorsToForm(form, saleZodIssuePath([...iss.path]), iss.message);
                  }
                  notify.error("Check the form for errors");
                  return;
                }
                const r = await adminCreateSaleResultAction(
                  api.data,
                  createIdempotencyKeyRef.current,
                );
                if (r.ok) {
                  clearWizardDraft(
                    wizardDraftCookieKey("admin_sale_new", wizardDraftEntityId ?? "new"),
                  );
                  notify.success("Draft sale created");
                  if (r.data?.id) {
                    router.push(`/admin/sales/${r.data.id}`);
                  } else {
                    notify.warning(
                      "Sale created but id was missing — open it from the sales list.",
                    );
                    router.push("/admin/sales");
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
                if (r.fieldErrors) {
                  applyActionFieldErrors(form, r.fieldErrors, {
                    stepFields: SALE_STEP_FIELDS,
                    goTo: wizardGoToRef.current,
                  });
                }
                return;
              }
              if (!saleId) {
                notify.error("Missing sale");
                return;
              }
              const api = isDraft
                ? safeParseUpdateSaleFromForm(values)
                : safeParseUpdatePublishedSaleFromForm(values);
              if (!api.success) {
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, saleZodIssuePath([...iss.path]), iss.message);
                }
                notify.error("Check the form for errors");
                return;
              }
              const r = await adminUpdateSaleResultAction(saleId, api.data);
              if (r.ok) {
                notify.success("Saved");
                router.push(`/admin/sales/${saleId}`);
                return;
              }
              notify.error(
                actionFailureNotifyMessage(r.error, {
                  status: r.status,
                  errorCode: r.errorCode,
                  meta: r.meta,
                }),
              );
              if (r.fieldErrors) {
                applyActionFieldErrors(form, r.fieldErrors, {
                  stepFields: SALE_STEP_FIELDS,
                  goTo: wizardGoToRef.current,
                });
              }
            });
          })}
        >
          {englishOnlyAuctionsLocked ? (
            <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
              English-only mode is on: any lots created with this sale must use the{" "}
              <span className="font-medium text-on-surface">english</span> auction type
            </p>
          ) : null}

          <AdminFormWizard
            steps={SALE_FORM_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            hideStickyOnMobile={Boolean(htmlFormId)}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={async (stepIndex) => {
              const fields = SALE_STEP_FIELDS[stepIndex];
              if (!fields?.length) return true;
              return validateWizardStep(form, adminSaleFormValuesSchema, fields);
            }}
            leadingSlot={
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={() =>
                  guardedPush(
                    mode === "create"
                      ? "/admin/sales"
                      : saleId
                        ? `/admin/sales/${saleId}`
                        : "/admin/sales",
                  )
                }
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
                {mode === "create" ? "Create draft sale" : "Save"}
              </LoadingButton>
            }
            {...wizardCreateDraftExtras}
          >
            {(stepIndex) => (
              <>
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
                  />
                ) : null}
                {stepIndex === 2 ? (
                  <SaleDocumentsStep
                    form={form}
                    mode={mode}
                    initialSaleDocuments={initialSaleDocuments}
                    {...(saleId ? { saleId } : {})}
                  />
                ) : null}
              </>
            )}
          </AdminFormWizard>

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
