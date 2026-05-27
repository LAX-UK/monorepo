"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import {
  findLotsOutsideSaleWindow,
  parseSaleWindowFromForm,
} from "@/lib/admin/sale-lot-window-sync";
import { scheduleLotConflictBanner } from "@/lib/admin/sale-setup/field-copy";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { formatDateTime, formatNumber } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { saleDeliveryModes } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { normalizeUkPostcode } from "@auction/validators";
import { useMemo } from "react";
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from "react-hook-form";

type TierPreview =
  | { ok: false }
  | {
      ok: true;
      kind: "tiered" | "flat";
      at250k: { hammer: string; premium: string };
      at600k: { hammer: string; premium: string };
    };

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  isOnsite: boolean;
  pending: boolean;
  fields: FieldArrayWithId<AdminSaleFormValues, "buyerPremiumTiers", "id">[];
  append: UseFieldArrayAppend<AdminSaleFormValues, "buyerPremiumTiers">;
  remove: UseFieldArrayRemove;
  tierBandPreview: TierPreview;
  formattedPreviewAddress: string;
  previewMapUrl: string | null;
  customMapUrl: string | undefined;
  postcodeIsValid: boolean;
  lots?: readonly Lot[];
  lotsSetupHref?: string;
};

export function SaleScheduleStep({
  form,
  isDraft,
  isOnsite,
  pending: _pending,
  fields,
  append,
  remove,
  tierBandPreview,
  formattedPreviewAddress,
  previewMapUrl,
  customMapUrl,
  postcodeIsValid,
  lots = [],
  lotsSetupHref,
}: Props) {
  const deliveryMode = form.watch("deliveryMode");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const lotConflicts = useMemo(() => {
    const window = parseSaleWindowFromForm({ deliveryMode, startTime, endTime });
    if (!window || lots.length === 0) return [];
    return findLotsOutsideSaleWindow(lots, window);
  }, [deliveryMode, endTime, lots, startTime]);
  const pendingWindow = parseSaleWindowFromForm({ deliveryMode, startTime, endTime });

  return (
    <>
      {lotConflicts.length > 0 && pendingWindow ? (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertDescription className="space-y-2 text-pretty font-body text-sm text-on-surface-variant">
            <p className="font-medium text-on-surface">
              {scheduleLotConflictBanner(lotConflicts.length)}
            </p>
            <p>
              Pending sale window: {formatDateTime(pendingWindow.startTime)} –{" "}
              {formatDateTime(pendingWindow.endTime)} (London time).
            </p>
            {lotsSetupHref ? (
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={lotsSetupHref}>Adjust lot schedules</a>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isDraft ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 font-body text-sm text-on-surface-variant">
          <strong className="text-warning">Read-only fields:</strong> Schedule, delivery mode, and
          buyer premium are locked after publish. Title, description, and cover images are still
          editable.
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
                value={field.value ?? ""}
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
                Online auctions support live bidding on each lot. Onsite auctions are marketing-only
                catalogs for in-person events; lots inherit the auction's start/end dates.
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
                  <p className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
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
                  <LabelCaps>Start (London)</LabelCaps>
                </FormLabel>
                <RhfDateTimePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={!isDraft}
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
                  <LabelCaps>End (London)</LabelCaps>
                </FormLabel>
                <RhfDateTimePicker
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={!isDraft}
                />
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
              <RhfDateTimePicker
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={!isDraft}
              />
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
            <p className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
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
              disabled={!isDraft}
              onClick={() => append({ hammerThresholdMajor: "0", rate: "" })}
            >
              Add tier bands
            </Button>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-end gap-3 border-b border-border-hairline pb-3 last:border-0 last:pb-0"
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
                                disabled={!isDraft}
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
                          <UnderlineInput placeholder="0.15" disabled={!isDraft} {...tierField} />
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
                    disabled={!isDraft}
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
                  disabled={!isDraft || fields.length >= 16}
                >
                  Add band
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!isDraft}
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
                £{formatNumber(Number(tierBandPreview.at250k.hammer), undefined, "en-GB")} hammer →
                buyer premium £{tierBandPreview.at250k.premium}
              </p>
              <p>
                £{formatNumber(Number(tierBandPreview.at600k.hammer), undefined, "en-GB")} hammer →
                premium £{tierBandPreview.at600k.premium}
              </p>
            </div>
          ) : null}
        </div>
      </CatalogFormSection>
    </>
  );
}
