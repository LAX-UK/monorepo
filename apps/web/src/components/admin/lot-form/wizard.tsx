"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import {
  clearWizardDraft,
  wizardDraftCookieKey,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import {
  adminCreateLotResultAction,
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import { applyZodErrorsToForm, zodIssuePathForForm } from "@/lib/admin/zod-form-errors";
import {
  type AdminLotFormValues,
  adminLotFormValuesSchema,
  formValuesToImageAltsPatch,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "@/lib/forms/schemas/admin-lot-form";
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
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z as zod } from "zod";
import { LotCatalogueStep } from "./steps/catalogue-step";
import { LotIdentityStep } from "./steps/identity-step";
import { LotSaleSellerStep } from "./steps/sale-seller-step";

const LOT_FORM_STEPS = [
  { id: "identity", label: "Identity" },
  { id: "sale-seller", label: "Sale & seller" },
  { id: "catalogue", label: "Catalogue" },
] as const;

const LOT_STEP_FIELDS: (keyof AdminLotFormValues)[][] = [
  ["title", "auctionType", "description"],
  ["sellerLegalEntityId"],
  [
    "artistId",
    "categoryIds",
    "reservePrice",
    "startingPrice",
    "endTime",
    "startTime",
    "dutchDecrementAmount",
    "dutchDecrementIntervalMs",
  ],
];

type SaleOption = Pick<Sale, "id" | "title" | "status">;

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
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const formSchema = useMemo(() => {
    if (!englishOnlyAuctionsLocked) return adminLotFormValuesSchema;
    return adminLotFormValuesSchema.superRefine((data, ctx) => {
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
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType]);

  const form = useForm<AdminLotFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const auctionTypeOptions = useMemo((): readonly LotAuctionType[] => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    if (mode === "create") return ["english"];
    if (defaultValues.auctionType !== "english") return lotAuctionTypes;
    return ["english"];
  }, [englishOnlyAuctionsLocked, mode, defaultValues.auctionType]);

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              form.clearErrors("root");
              if (mode === "create") {
                const api = safeParseCreateLotFromForm(values);
                if (!api.success) {
                  for (const iss of api.error.issues) {
                    applyZodErrorsToForm(form, zodIssuePathForForm([...iss.path]), iss.message);
                  }
                  notify.error("Check the form for errors");
                  return;
                }
                const r = await adminCreateLotResultAction(api.data);
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
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, zodIssuePathForForm([...iss.path]), iss.message);
                }
                notify.error("Check the form for errors");
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
          })}
        >
          {mode === "edit" ? (
            <AdminDetailTabs
              defaultValue="overview"
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
                    <LotCatalogueStep form={form} categories={categories} artists={artists} />
                  ),
                },
              ]}
            />
          ) : (
            <AdminFormWizard
              steps={LOT_FORM_STEPS}
              isDirty={form.formState.isDirty}
              pending={pending}
              draft={{
                entityKind: "lot",
                entityId: "new",
                values: form.getValues() as Record<string, unknown>,
              }}
              onBeforeNext={async (stepIndex) => {
                const fields = LOT_STEP_FIELDS[stepIndex];
                if (!fields?.length) return true;
                return form.trigger(fields);
              }}
              leadingSlot={
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => router.push("/admin/lots")}
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
                    />
                  ) : null}
                  {stepIndex === 1 ? <LotSaleSellerStep form={form} sales={sales} /> : null}
                  {stepIndex === 2 ? (
                    <LotCatalogueStep form={form} categories={categories} artists={artists} />
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
                  onClick={() => router.push(lotId ? `/admin/lots/${lotId}` : "/admin/lots")}
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
