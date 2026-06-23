"use client";

import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { UnderlineInput } from "@/components/ui/input";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { RhfLegalEntityPicker } from "@/components/ui/rhf-legal-entity-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import { adminAddLotToSaleResultAction } from "@/lib/actions/admin-sales";
import { notifyAdminFormValidationFailure } from "@/lib/admin/admin-form-validation-notify";
import { deliveryModeExplanation } from "@/lib/admin/sale-setup/field-copy";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import {
  type EmergencyAddLotFormValues,
  emergencyAddLotFormSchema,
  emptyEmergencyAddLotRow,
  safeParseEmergencyAddLotForApi,
} from "@/lib/admin/sale-setup/lot-row-schema";
import { applySellerLegalEntitySelection } from "@/lib/admin/seller-legal-entity-form";
import { applyZodIssuesToForm } from "@/lib/forms/apply-action-field-errors";
import { actionFailureNotifyMessage } from "@/lib/ui/action-error-message";
import { notify } from "@/lib/ui/notify";
import type { CategoryNode, LotAuctionType, SaleDeliveryMode, SaleStatus } from "@auction/types";
import { lotAuctionTypes } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { getSaleModeCapabilities } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  deliveryMode: SaleDeliveryMode;
  saleStartTime: Date;
  saleEndTime: Date;
  categories: CategoryNode[];
  englishOnlyAuctionsLocked: boolean;
};

function fieldTierSuffix(tier: "required" | "optional"): string {
  return tier === "required" ? " *" : "";
}

export function EmergencyAddLotPanel({
  saleId,
  saleStatus,
  deliveryMode,
  saleStartTime,
  saleEndTime,
  categories,
  englishOnlyAuctionsLocked,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const caps = getSaleModeCapabilities(deliveryMode);
  const inheritsTiming = caps.inheritsLotTiming;

  const form = useForm<EmergencyAddLotFormValues>({
    resolver: zodResolver(emergencyAddLotFormSchema) as Resolver<EmergencyAddLotFormValues>,
    defaultValues: emptyEmergencyAddLotRow(crypto.randomUUID()),
  });

  const auctionTypeOptions = useMemo(() => {
    if (!englishOnlyAuctionsLocked) return lotAuctionTypes;
    return ["english"] as const;
  }, [englishOnlyAuctionsLocked]);

  const ctx = useMemo(
    () => ({
      saleStartTime,
      saleEndTime,
      deliveryMode,
      englishOnlyAuctionsLocked,
    }),
    [deliveryMode, englishOnlyAuctionsLocked, saleEndTime, saleStartTime],
  );

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const parsed = safeParseEmergencyAddLotForApi(values, ctx);
      if (!parsed.success) {
        applyZodIssuesToForm(form, parsed.error.issues);
        notifyAdminFormValidationFailure({ issues: parsed.error.issues });
        return;
      }
      const r = await adminAddLotToSaleResultAction(saleId, parsed.data);
      if (!r.ok) {
        const lotId = typeof r.meta?.lotId === "string" ? r.meta.lotId : null;
        const rolledBack = r.meta?.rolledBack === true;
        notify.error(
          humanizeSetupError({
            message: actionFailureNotifyMessage(r.error, {
              status: r.status,
              errorCode: r.errorCode,
              meta: r.meta,
            }),
            errorCode: r.errorCode,
          }),
          rolledBack && lotId
            ? {
                description: `Saved as standalone inventory (lot ${lotId.slice(0, 8)}…). Open it to fix and retry.`,
              }
            : undefined,
        );
        if (rolledBack && lotId) {
          router.push(`/admin/lots/${lotId}`);
        }
        return;
      }
      if (!r.data?.id) return;
      notify.success(
        saleStatus === "active" ? "Lot added to live sale" : "Lot added and scheduled",
        {
          description: "The lot is ready for the clerk or online timer.",
        },
      );
      form.reset(emptyEmergencyAddLotRow(crypto.randomUUID()));
      router.refresh();
    });
  });

  return (
    <div id="add-lot-to-live-sale" className="scroll-mt-24">
      <DisplayHeading as="h2" className="text-xl">
        Add lot to {saleStatus === "active" ? "live" : "scheduled"} sale
      </DisplayHeading>
      <p className="mt-2 font-body text-sm text-on-surface-variant">
        Complete catalogue details below. The lot is scheduled immediately after you save — images
        and description are required.
      </p>
      <Alert className="mt-4">
        <AlertDescription>{deliveryModeExplanation(deliveryMode)}</AlertDescription>
      </Alert>
      <Form {...form}>
        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-xl border border-border-hairline bg-surface-container-low/40 p-5"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Title{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput {...field} placeholder="Lot title" disabled={pending} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Description{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    disabled={pending}
                    placeholder="Catalogue description for bidders"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Images{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <ImageUploadField
                    kind="lot_image"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                    multiple
                    maxFiles={50}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sellerLegalEntityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Seller{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <RhfLegalEntityPicker
                  value={field.value || null}
                  displayLabel={form.watch("sellerDisplayName")?.trim() || null}
                  onChange={(id, row) =>
                    applySellerLegalEntitySelection(
                      field.onChange,
                      (name) =>
                        form.setValue("sellerDisplayName", name, {
                          shouldDirty: true,
                          shouldValidate: false,
                        }),
                      id,
                      row,
                    )
                  }
                  disabled={pending}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Categories{fieldTierSuffix("required")}</LabelCaps>
                </FormLabel>
                <FormControl>
                  <CategoryPicker
                    categories={categories}
                    value={field.value}
                    onChange={field.onChange}
                    multiple
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="auctionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Auction type{fieldTierSuffix("required")}</LabelCaps>
                  </FormLabel>
                  <RhfSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={pending || englishOnlyAuctionsLocked}
                    options={auctionTypeOptions.map((t: LotAuctionType) => ({
                      value: t,
                      label: t.replace(/_/g, " "),
                    }))}
                    triggerClassName="w-full font-body text-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Starting price{fieldTierSuffix("required")}</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} disabled={pending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!inheritsTiming ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelCaps>Lot opens{fieldTierSuffix("required")}</LabelCaps>
                    </FormLabel>
                    <RhfDateTimePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={pending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelCaps>Lot closes{fieldTierSuffix("required")}</LabelCaps>
                    </FormLabel>
                    <RhfDateTimePicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={pending}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add lot to sale"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
