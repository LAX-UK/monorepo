"use client";

import { RhfSelect } from "@/components/ui/rhf-select";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminCreateSaleResultAction,
  adminUpdateSaleResultAction,
} from "@/lib/actions/admin-sales";
import {
  type AdminSaleFormValues,
  adminSaleFormValuesSchema,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "@/lib/forms/schemas/admin-sale-form";
import { saleDeliveryModes } from "@auction/types";
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
  buildGoogleMapsSearchUrl,
  formatPostalAddress,
  isUkPostcode,
  normalizeUkPostcode,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  mode: "create" | "edit";
  saleId?: string;
  defaultValues: AdminSaleFormValues;
};

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

export function AdminSaleForm({ mode, saleId, defaultValues }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminSaleFormValues>({
    resolver: zodResolver(adminSaleFormValuesSchema),
    defaultValues,
  });

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
                  applyZodErrorsToForm(form, iss.path, iss.message);
                }
                toast.error("Check the form for errors");
                return;
              }
              const r = await adminCreateSaleResultAction(api.data);
              if (r.ok) {
                toast.success("Draft sale created");
                if (r.data?.id) router.push(`/admin/sales/${r.data.id}`);
                return;
              }
              toast.error(r.error);
              return;
            }
            if (!saleId) {
              toast.error("Missing sale");
              return;
            }
            const api = safeParseUpdateSaleFromForm(values);
            if (!api.success) {
              for (const iss of api.error.issues) {
                applyZodErrorsToForm(form, iss.path, iss.message);
              }
              toast.error("Check the form for errors");
              return;
            }
            const r = await adminUpdateSaleResultAction(saleId, api.data);
            if (r.ok) {
              toast.success("Saved");
              router.push(`/admin/sales/${saleId}`);
              return;
            }
            toast.error(r.error);
          });
        })}
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
                <LabelCaps>Cover image URLs (one per line)</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="coverImages"
                  rows={3}
                  className="font-body text-sm"
                  placeholder="https://..."
                  {...field}
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
                <LabelCaps>Theme category ID (optional UUID)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput id="categoryId" placeholder="" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                onValueChange={field.onChange}
                onBlur={field.onBlur}
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
                    className="min-h-11 py-3 font-body text-sm"
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
                    className="min-h-11 py-3 font-body text-sm"
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

        <FormField
          control={form.control}
          name="buyerPremiumRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LabelCaps>Buyer premium (0–1)</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput id="buyerPremiumRate" placeholder="0.25" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        {form.formState.errors.root ? (
          <p className="text-sm text-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-md bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "create" ? "Create draft sale" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
