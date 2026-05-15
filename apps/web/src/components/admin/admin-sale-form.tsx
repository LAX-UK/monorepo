"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { SaleDocumentsSection } from "@/components/admin/sale-form/sale-documents-section";
import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageGalleryManager } from "@/components/forms/image-gallery-manager";
import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminCreateSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  type AdminSaleFormValues,
  adminSaleFormValuesSchema,
  normalizeAdminFormTiersToApi,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { notify } from "@/lib/ui/notify";
import { type CategoryNode, type EntityDocument, saleDeliveryModes } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Textarea } from "@auction/ui/components/textarea";
import {
  buildBuyerPremiumPolicy,
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isUkPostcode,
  normalizeUkPostcode,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { type FieldPath, useFieldArray, useForm } from "react-hook-form";

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
};

function zodIssuePathForForm(path: (string | number)[]): (string | number)[] {
  if (path.length > 0 && typeof path[0] === "number") {
    return ["buyerPremiumTiers", ...path];
  }
  return path;
}

function applyZodErrorsToForm(
  form: ReturnType<typeof useForm<AdminSaleFormValues>>,
  path: (string | number)[],
  message: string,
): void {
  if (!path.length) {
    form.setError("root", { message });
    return;
  }
  form.setError(path.map(String).join(".") as FieldPath<AdminSaleFormValues>, { message });
}

export function AdminSaleForm({
  mode,
  saleId,
  saleStatus,
  defaultValues,
  categories,
  englishOnlyAuctionsLocked = false,
  initialSaleDocuments = [],
}: Props) {
  const isDraft = mode === "create" || !saleStatus || saleStatus === "draft";
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(adminSaleFormValuesSchema),
    defaultValues,
  });

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

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            form.clearErrors("root");
            if (mode === "create") {
              const api = safeParseCreateSaleFromForm(values);
              if (!api.success) {
                for (const iss of api.error.issues) {
                  applyZodErrorsToForm(form, zodIssuePathForForm([...iss.path]), iss.message);
                }
                notify.error("Check the form for errors");
                return;
              }
              const r = await adminCreateSaleResultAction(api.data);
              if (r.ok) {
                notify.success("Draft sale created");
                if (r.data?.id) router.push(`/admin/sales/${r.data.id}`);
                return;
              }
              notify.error(r.error);
              return;
            }
            if (!saleId) {
              notify.error("Missing sale");
              return;
            }
            const api = safeParseUpdateSaleFromForm(values);
            if (!api.success) {
              for (const iss of api.error.issues) {
                applyZodErrorsToForm(form, zodIssuePathForForm([...iss.path]), iss.message);
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
            notify.error(r.error);
          });
        })}
      >
        {englishOnlyAuctionsLocked ? (
          <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
            English-only mode is on: any lots created with this sale must use the{" "}
            <span className="font-medium text-on-surface">english</span> auction type (the database
            enum is unchanged for legacy rows).
          </p>
        ) : null}

        <CatalogFormSection
          title="Identity & discovery"
          description="Title, description, cover art, and optional theme category."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Title</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="Sale title" {...field} />
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
                <FormLabel className="mb-2 block">
                  <LabelCaps>Description</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea id="description" rows={4} className="font-body text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coverImages"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Cover images</LabelCaps>
                </FormLabel>
                <p className="mb-2 font-body text-xs text-on-surface-variant">
                  The first image is shown as the primary auction cover on listing pages.
                </p>
                <FormControl>
                  <ImageGalleryManager
                    kind="sale_cover"
                    label="Auction cover"
                    value={field.value}
                    onChange={field.onChange}
                    maxFiles={20}
                    emptyTitle="No cover images yet"
                    emptyDescription="Upload cover images, then drag to reorder. The first image is the primary cover."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Theme category</LabelCaps>
                </FormLabel>
                <FormControl>
                  <CategoryPicker
                    categories={categories}
                    value={field.value ? [field.value] : []}
                    onChange={(next) => field.onChange(next[0] ?? "")}
                    placeholder="Select a category (optional)"
                    multiple={false}
                  />
                </FormControl>
                <p className="mt-2 font-body text-xs text-on-surface-variant">
                  Optional theme used for public sale discovery and internal filtering.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </CatalogFormSection>

        {!isDraft ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 font-body text-sm text-on-surface-variant">
            <strong className="text-warning">Read-only fields:</strong> Schedule, delivery mode, and
            buyer premium are locked after publish. Title, description, images, documents, and
            marketing copy are still editable.
          </div>
        ) : null}

        <CatalogFormSection
          title="Delivery & venue"
          description="Online vs onsite, stream link, and structured venue when applicable."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="deliveryMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Auction type</LabelCaps>
                </FormLabel>
                <RhfSelect
                  value={field.value}
                  onValueChange={(v) => {
                    if (isDraft) field.onChange(v);
                  }}
                  onBlur={field.onBlur}
                  disabled={!isDraft}
                  options={saleDeliveryModes.map((m) => ({
                    value: m,
                    label:
                      m === "onsite"
                        ? "Onsite (read-only marketing)"
                        : "Online (interactive bidding)",
                  }))}
                  triggerClassName="w-full font-body text-sm"
                />
                <p className="mt-2 font-body text-xs text-on-surface-variant">
                  Online auctions support live bidding on each lot. Onsite auctions are
                  marketing-only catalogs for in-person events; lots inherit the auction's start/end
                  dates.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {isOnsite ? (
            <>
              <FormField
                control={form.control}
                name="streamUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 block">
                      <LabelCaps>Live stream URL (optional)</LabelCaps>
                    </FormLabel>
                    <FormControl>
                      <UnderlineInput
                        id="streamUrl"
                        placeholder="https://www.youtube.com/watch?v=…"
                        {...field}
                      />
                    </FormControl>
                    <p className="mt-2 font-body text-xs text-on-surface-variant">
                      Optional livestream for the onsite event. Allowed: YouTube, Vimeo, Twitch,
                      Cloudflare Stream.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-6 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/40 p-4">
                <div>
                  <LabelCaps>Venue location</LabelCaps>
                  <p className="mt-2 font-body text-xs text-on-surface-variant">
                    Used for the public onsite catalog page. Structured fields generate a clean
                    formatted address and a Google Maps link. UK postcodes are normalized
                    automatically (e.g. "sw1y6qu" → "SW1Y 6QU").
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="locationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Venue name</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <UnderlineInput
                          id="locationName"
                          placeholder="Auction House, Gallery, Hotel..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationAddressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Address line 1</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <UnderlineInput
                          id="locationAddressLine1"
                          placeholder="34 New Bond Street"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationAddressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Address line 2 (optional)</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <UnderlineInput
                          id="locationAddressLine2"
                          placeholder="Apartment, suite, building..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="locationCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-2 block">
                          <LabelCaps>City / town</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput id="locationCity" placeholder="London" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="locationCounty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-2 block">
                          <LabelCaps>County (optional)</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput
                            id="locationCounty"
                            placeholder="Greater London"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="locationPostcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-2 block">
                          <LabelCaps>Postcode</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput
                            id="locationPostcode"
                            placeholder="SW1Y 6QU"
                            {...field}
                            onBlur={(event) => {
                              const value = event.target.value.trim();
                              if (value) {
                                field.onChange(normalizeUkPostcode(value));
                              }
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        {!postcodeIsValid ? (
                          <p className="mt-1 font-body text-xs text-error">
                            Enter a valid UK postcode (e.g. SW1Y 6QU).
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="locationCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="mb-2 block">
                          <LabelCaps>Country</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput
                            id="locationCountry"
                            placeholder="United Kingdom"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="locationAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Free-form address (optional fallback)</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="locationAddress"
                          rows={2}
                          className="font-body text-sm"
                          placeholder="Used as a display fallback when structured fields above are blank."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationMapUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Custom map URL (optional override)</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <UnderlineInput
                          id="locationMapUrl"
                          placeholder="https://maps.google.com/..."
                          {...field}
                        />
                      </FormControl>
                      <p className="mt-2 font-body text-xs text-on-surface-variant">
                        If left blank, a Google Maps link will be generated from the address fields
                        above (no API key required).
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formattedPreviewAddress || previewMapUrl ? (
                  <div className="rounded-md border border-dashed border-outline-variant/40 bg-surface-container-lowest p-3">
                    <p className="font-label text-[0.65rem] uppercase tracking-[0.25em] text-on-surface-variant">
                      Live preview
                    </p>
                    {formattedPreviewAddress ? (
                      <p className="mt-2 font-body text-sm text-on-surface">
                        {formattedPreviewAddress}
                      </p>
                    ) : null}
                    {customMapUrl?.trim() ? (
                      <a
                        href={customMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-body text-xs text-primary underline"
                      >
                        Open custom map URL
                      </a>
                    ) : previewMapUrl ? (
                      <a
                        href={previewMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block font-body text-xs text-primary underline"
                      >
                        Open in Google Maps
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </CatalogFormSection>

        <CatalogFormSection
          title="Schedule"
          description="Sale window and optional preview start."
          collapsible={false}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <LabelCaps>Start (local)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      className="min-h-11 py-3 font-body text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!isDraft}
                      {...field}
                    />
                  </FormControl>
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
                    <LabelCaps>End (local)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      className="min-h-11 py-3 font-body text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!isDraft}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {isOnsite ? (
            <p className="-mt-4 font-body text-xs text-on-surface-variant">
              For onsite auctions the start/end window controls the entire event. All lots in this
              auction will share these times automatically.
            </p>
          ) : null}

          <FormField
            control={form.control}
            name="previewStartTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Preview start (optional)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    className="min-h-11 py-3 font-body text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CatalogFormSection>

        <CatalogFormSection
          title="Buyer premium"
          description="Flat rate and optional tier bands (draft only)."
          collapsible={false}
        >
          <FormField
            control={form.control}
            name="buyerPremiumRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <LabelCaps>Buyer premium (0–1)</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput
                    id="buyerPremiumRate"
                    placeholder="0.25"
                    disabled={!isDraft}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-4">
            <div>
              <p className="font-label text-[0.65rem] uppercase tracking-[0.25em] text-on-surface-variant">
                Buyer premium bands (optional)
              </p>
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                Leave empty for a single flat rate (field above). When bands exist, the rate for the
                whole hammer is the one on the highest threshold still at or below the hammer
                (band-based, not progressive). The first band always starts at £0.
              </p>
            </div>
            {fields.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ hammerThresholdMajor: "0", rate: "" })}
              >
                Add tier bands
              </Button>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-wrap items-end gap-3 border-b border-outline-variant/15 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-[160px] flex-1">
                      {index === 0 ? (
                        <p className="pb-2 font-body text-xs text-on-surface-variant">From £0</p>
                      ) : (
                        <FormField
                          control={form.control}
                          name={`buyerPremiumTiers.${index}.hammerThresholdMajor`}
                          render={({ field: tierField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">From (£, major units)</FormLabel>
                              <FormControl>
                                <UnderlineInput
                                  placeholder="e.g. 500000 for £500k"
                                  {...tierField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name={`buyerPremiumTiers.${index}.rate`}
                      render={({ field: tierField }) => (
                        <FormItem className="min-w-[120px] flex-1">
                          <FormLabel className="text-xs">Rate (0–1)</FormLabel>
                          <FormControl>
                            <UnderlineInput placeholder="0.15" {...tierField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-error"
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ hammerThresholdMajor: "", rate: "" })}
                    disabled={fields.length >= 16}
                  >
                    Add band
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue("buyerPremiumTiers", [])}
                  >
                    Remove all bands
                  </Button>
                </div>
              </div>
            )}
            {tierBandPreview.ok ? (
              <div className="rounded border border-dashed border-outline-variant/50 p-3 font-body text-xs text-on-surface-variant">
                <p className="font-medium text-on-surface">
                  Preview — {tierBandPreview.kind === "tiered" ? "tiered" : "flat"} policy
                </p>
                <p className="mt-1">
                  £{Number(tierBandPreview.at250k.hammer).toLocaleString("en-GB")} hammer → buyer
                  premium £{tierBandPreview.at250k.premium}
                </p>
                <p>
                  £{Number(tierBandPreview.at600k.hammer).toLocaleString("en-GB")} hammer → buyer
                  premium £{tierBandPreview.at600k.premium}
                </p>
              </div>
            ) : null}
          </div>
        </CatalogFormSection>

        <CatalogFormSection title="Documents & terms" collapsible={false}>
          {mode === "edit" && saleId ? (
            <SaleDocumentsSection saleId={saleId} initialDocuments={initialSaleDocuments} />
          ) : null}

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 block">
                  <LabelCaps>Terms of sale</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea id="terms" rows={4} className="font-body text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CatalogFormSection>

        {form.formState.errors.root ? (
          <p className="text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <div className="flex flex-col justify-end gap-3 border-t border-outline-variant/20 pt-6 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              router.push(
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
          <Button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full sm:min-w-40 sm:w-auto"
          >
            {pending ? "Saving…" : mode === "create" ? "Create draft sale" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
