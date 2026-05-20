"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { LabelCaps } from "@/components/ui/typography";
import { adminUpdateLotMarketingDetailsResultAction } from "@/lib/actions/admin";
import {
  type AdminLotMarketingFormValues,
  adminLotMarketingFormValuesSchema,
  formValuesToApiPatch,
  marketingDetailsToFormValues,
} from "@/lib/admin/admin-lot-marketing-mappers";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, LotMarketingDetails } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { updateLotMarketingDetailsSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { ArtistAttributionPanel } from "./artist-attribution-panel";
import { LotMarketingArtistStoryStep } from "./steps/artist-story-step";
import { LotMarketingCatalogStep } from "./steps/catalog-step";

const LOT_MARKETING_FORM_STEPS = [
  { id: "catalog", label: "Catalog copy" },
  { id: "artist-story", label: "Artist story" },
] as const;

type Props = {
  lotId: string;
  marketingDetails: LotMarketingDetails;
  artists: ArtistProfile[];
  /** FK on the lot row. Marketing form is read-only on this concern: catalog
   * copy and artist attribution are persisted via separate endpoints. */
  artistId: string | null;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
};

export function AdminLotMarketingForm({
  lotId,
  marketingDetails,
  artists,
  artistId,
  htmlFormId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminLotMarketingFormValues>({
    resolver: zodResolver(adminLotMarketingFormValuesSchema),
    defaultValues: marketingDetailsToFormValues(marketingDetails),
  });

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
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
                    notify.success("Catalog details saved");
                    router.refresh();
                    return;
                  }
                  notify.error(r.error);
                })();
              });
            })}
          >
            <AdminFormWizard
              steps={LOT_MARKETING_FORM_STEPS}
              isDirty={form.formState.isDirty}
              pending={pending}
              leadingSlot={
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => router.push(`/admin/lots/${lotId}`)}
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
