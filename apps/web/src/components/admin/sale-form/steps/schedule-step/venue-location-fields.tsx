import { UnderlineInput } from "@/components/ui/input";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { Venue } from "@auction/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { normalizeUkPostcode } from "@auction/validators";
import type { UseFormReturn } from "react-hook-form";

const MANUAL_VENUE_VALUE = "__manual__";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  venues: readonly Venue[];
  formattedPreviewAddress: string;
  previewMapUrl: string | null;
  customMapUrl: string | undefined;
  postcodeIsValid: boolean;
};

export function VenueLocationFields({
  form,
  isDraft,
  venues,
  formattedPreviewAddress,
  previewMapUrl,
  customMapUrl,
  postcodeIsValid,
}: Props) {
  function applyVenue(venue: Venue) {
    form.setValue("venueId", venue.id, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationName", venue.name, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationAddressLine1", venue.addressLine1, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("locationAddressLine2", venue.addressLine2 ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("locationCity", venue.city, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationCounty", venue.county ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("locationPostcode", venue.postcode, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationCountry", venue.country, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationMapUrl", venue.mapUrl ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="space-y-6 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/40 p-4">
      <div>
        <LabelCaps>Venue location</LabelCaps>
        <p className="mt-2 font-body text-xs text-on-surface-variant">
          Shown on the public sale page when published. Structured fields generate a clean formatted
          address and a Google Maps link. UK postcodes are normalized automatically (e.g. "sw1y6qu"
          → "SW1Y 6QU").
        </p>
      </div>

      <FormField
        control={form.control}
        name="venueId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="mb-2 block">
              <LabelCaps>Saved venue</LabelCaps>
            </FormLabel>
            <RhfSelect
              value={field.value || MANUAL_VENUE_VALUE}
              onValueChange={(value) => {
                if (!isDraft) return;
                if (value === MANUAL_VENUE_VALUE) {
                  field.onChange("");
                  return;
                }
                const selected = venues.find((venue) => venue.id === value);
                if (selected) applyVenue(selected);
              }}
              onBlur={field.onBlur}
              disabled={!isDraft || venues.length === 0}
              placeholder={venues.length === 0 ? "No saved venues yet" : "Select a venue"}
              options={[
                { value: MANUAL_VENUE_VALUE, label: "Manual / one-off venue" },
                ...venues.map((venue) => ({
                  value: venue.id,
                  label: `${venue.name} · ${venue.city}`,
                })),
              ]}
              triggerClassName="w-full font-body text-sm"
            />
            {venues.length === 0 ? (
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                No saved venues.{" "}
                <a
                  href="/admin/venues?new=1"
                  className="text-link underline-offset-2 hover:underline"
                >
                  Create a venue
                </a>{" "}
                to reuse address details across onsite sales.
              </p>
            ) : (
              <p className="mt-2 font-body text-xs text-on-surface-variant">
                Venues listed here belong to the sale operator (LAX). Lot seller organisations are
                separate — consignor lots can be sold in a LAX-owned gallery without any conflict.
                Saved venues auto-fill the address fields below; the venue record is snapshotted
                when you publish.
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

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
                <UnderlineInput id="locationCounty" placeholder="Greater London" {...field} />
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
                <UnderlineInput id="locationCountry" placeholder="United Kingdom" {...field} />
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
              If left blank, a Google Maps link will be generated from the address fields above (no
              API key required).
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
            <p className="mt-2 font-body text-sm text-on-surface">{formattedPreviewAddress}</p>
          ) : null}
          {customMapUrl?.trim() ? (
            <a
              href={customMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-body text-xs text-link underline"
            >
              Open custom map URL
            </a>
          ) : previewMapUrl ? (
            <a
              href={previewMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-body text-xs text-link underline"
            >
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
