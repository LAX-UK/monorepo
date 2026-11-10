"use client";

import { zoneForVenueCountry } from "@/lib/admin/sale-time-zone/venue-country-zone";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

/**
 * Follows the venue's country: when staff change it and the country keeps a single zone, the
 * sale's zone becomes that zone, until staff choose a zone themselves. Opening the form never
 * changes a saved zone, and a country with several zones (or none given) changes nothing.
 */
export function useVenueCountryTimeZone(
  form: UseFormReturn<AdminSaleFormValues>,
  enabled: boolean,
): void {
  const country = form.watch("locationCountry");
  const chosenByStaff = form.formState.dirtyFields.timeZone === true;
  const previousCountry = useRef(country);

  useEffect(() => {
    if (previousCountry.current === country) return;
    previousCountry.current = country;
    if (!enabled || chosenByStaff) return;
    const zone = zoneForVenueCountry(country);
    if (zone && zone !== form.getValues("timeZone")) {
      form.setValue("timeZone", zone, { shouldDirty: false, shouldValidate: false });
    }
  }, [chosenByStaff, country, enabled, form]);
}
