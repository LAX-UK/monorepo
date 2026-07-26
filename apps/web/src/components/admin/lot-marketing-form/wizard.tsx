"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import {
  type LotEditSectionId,
  useLotEditSectionDirty,
} from "@/components/admin/lot-form/lot-edit-form-context";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import { LabelCaps } from "@/components/ui/typography";
import { adminUpdateLotMarketingDetailsResultAction } from "@/lib/actions/admin";
import {
  type AdminLotMarketingFormValues,
  adminLotMarketingFormValuesSchema,
  formValuesToApiPatch,
  marketingDetailsToFormValues,
} from "@/lib/admin/admin-lot-marketing-mappers";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, LotMarketingDetails } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { updateLotMarketingDetailsSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { ArtistAttributionPanel } from "./artist-attribution-panel";
import { LotMarketingArtistStoryStep } from "./steps/artist-story-step";
import { LotMarketingCatalogStep } from "./steps/catalog-step";

const LOT_MARKETING_FORM_STEPS = [
  { id: "catalog", label: "Catalog copy" },
  { id: "artist-story", label: "Artist story" },
] as const;

const LOT_MARKETING_STEP_FIELDS: (keyof AdminLotMarketingFormValues)[][] = [
  ["estimate", "conditionReport", "provenance", "exhibitions"],
  ["artistNote"],
];

type Props = {
  lotId: string;
  marketingDetails: LotMarketingDetails;
  artists: ArtistProfile[];
  /** FK on the lot row. Marketing form is read-only on this concern: catalog
   * copy and artist attribution are persisted via separate endpoints. */
  artistId: string | null;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
  lotEditSection?: LotEditSectionId;
};

export function AdminLotMarketingForm({
  lotId,
  marketingDetails,
  artists,
  artistId,
  htmlFormId,
  lotEditSection,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const form = useForm<AdminLotMarketingFormValues>({
    resolver: zodResolver(adminLotMarketingFormValuesSchema),
    defaultValues: marketingDetailsToFormValues(marketingDetails),
  });
  useLotEditSectionDirty(
    "catalog",
    Boolean(lotEditSection === "catalog" && form.formState.isDirty),
  );
  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  return (
    <>
      {!lotEditSection ? <FormDirtyGuard isDirty={form.formState.isDirty} /> : null}
      <div className="space-y-8 rounded-sm border border-border-hairline bg-surface-container-lowest/40 p-6">
        <div>
          <LabelCaps className="text-secondary">Catalog & marketing</LabelCaps>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Lot story</h2>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            These fields feed the public artwork page (estimate, condition, provenance, exhibitions,
            about the artist, plus fees and documents where configured). Changes apply immediately
            for lots that can still be edited in the catalogue.
          </p>
        </div>
        <ArtistAttributionPanel
          lotId={lotId}
          artists={artists}
          artistId={artistId}
          onSaved={() => router.refresh()}
        />
        <Form {...form}>
          <form
            id={htmlFormId}
            className="space-y-8"
            onSubmit={form.handleSubmit((values) => {
              const patch = formValuesToApiPatch(values);
              const valid = updateLotMarketingDetailsSchema.safeParse(patch);
              if (!valid.success) {
                notify.error(valid.error.issues.map((i) => i.message).join("; "));
                return;
              }
              startTransition(() => {
                void (async () => {
                  const r = await adminUpdateLotMarketingDetailsResultAction(lotId, valid.data);
                  if (r.ok) {
                    form.reset(marketingDetailsToFormValues(valid.data as LotMarketingDetails));
                    notify.success("Catalog details saved");
                    router.refresh();
                    return;
                  }
                  if (r.fieldErrors) {
                    applyActionFieldErrors(form, r.fieldErrors, {
                      stepFields: LOT_MARKETING_STEP_FIELDS,
                      goTo: wizardGoToRef.current,
                    });
                  }
                  notify.error(r.error);
                })();
              });
            })}
          >
            <AdminFormWizard
              key={lotId}
              steps={LOT_MARKETING_FORM_STEPS}
              isDirty={form.formState.isDirty}
              pending={pending}
              hideStickyOnMobile={Boolean(htmlFormId)}
              onStepControl={({ goTo }) => {
                wizardGoToRef.current = goTo;
              }}
              onBeforeNext={async (stepIndex) => {
                const fields = LOT_MARKETING_STEP_FIELDS[stepIndex];
                if (!fields?.length) return true;
                return validateWizardStep(form, adminLotMarketingFormValuesSchema, fields);
              }}
              leadingSlot={
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => guardedPush(`/admin/lots/${lotId}`)}
                >
                  Back to lot
                </Button>
              }
              submitSlot={
                <LoadingButton
                  type="submit"
                  loading={pending}
                  loadingLabel="Saving…"
                  className="min-h-11 w-full sm:min-w-40 sm:w-auto"
                >
                  Save catalog copy
                </LoadingButton>
              }
            >
              {(stepIndex) => (
                <>
                  {stepIndex === 0 ? (
                    <LotMarketingCatalogStep form={form} pending={pending} />
                  ) : null}
                  {stepIndex === 1 ? <LotMarketingArtistStoryStep form={form} /> : null}
                </>
              )}
            </AdminFormWizard>
          </form>
        </Form>
      </div>
    </>
  );
}
