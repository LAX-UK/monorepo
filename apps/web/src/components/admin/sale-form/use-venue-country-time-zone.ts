"use client";

import { zoneForVenueCountry } from "@/lib/admin/sale-time-zone/venue-country-zone";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

/**
 * Follows the venue's country: when staff change it and the country keeps a single zone, the
 * sale's zone becomes that zone, until staff choose a zone themselves, including London. The
 * choice is tracked explicitly (any change to the zone that this hook did not make), so it never
 * depends on whether the value happens to differ from the saved one. Opening the form never
 * changes a saved zone, and a country with several zones (or none given) changes nothing.
 */
export function useVenueCountryTimeZone(
  form: UseFormReturn<AdminSaleFormValues>,
  enabled: boolean,
): void {
  const country = form.watch("locationCountry");
  const previousCountry = useRef(country);
  const chosenByStaff = useRef(false);
  const applying = useRef(false);

  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (name === "timeZone" && !applying.current) chosenByStaff.current = true;
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (previousCountry.current === country) return;
    previousCountry.current = country;
    if (!enabled || chosenByStaff.current) return;
    const zone = zoneForVenueCountry(country);
    if (!zone || zone === form.getValues("timeZone")) return;
    applying.current = true;
    try {
      form.setValue("timeZone", zone, { shouldDirty: false, shouldValidate: false });
    } finally {
      applying.current = false;
    }
  }, [country, enabled, form]);
}
