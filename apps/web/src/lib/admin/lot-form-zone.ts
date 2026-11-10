import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import { readingZone } from "@/lib/forms/schemas/reading-zone";
import { instantFromDatetimeFormString, toDatetimeFormString } from "@auction/ui/lib/datetime";
import type { UseFormReturn } from "react-hook-form";

/**
 * Points the lot form at its sale's zone. The lot's moments do not move: times already typed are
 * read in the zone they were typed in and written again on the new clock, so choosing a sale in
 * another zone relabels nothing. Does nothing when the form already reads in that zone.
 */
export function moveLotFormToZone(form: UseFormReturn<AdminLotFormValues>, zone: string): void {
  const current = form.getValues("timeZone");
  if (current === zone) return;
  const from = readingZone(current);
  for (const name of ["startTime", "endTime"] as const) {
    const raw = form.getValues(name);
    if (!raw?.trim()) continue;
    const instant = instantFromDatetimeFormString(raw, from);
    if (Number.isNaN(instant.getTime())) continue;
    form.setValue(name, toDatetimeFormString(instant, zone), { shouldDirty: false });
  }
  form.setValue("timeZone", zone, { shouldDirty: false });
}
