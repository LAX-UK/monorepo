import { COUNTRY_CODES, countryName } from "@/lib/ui/countries";
import type { EntityOption } from "@auction/staff-ui";

export { countryName };

/** The countries as picker options: the name in English, the code beneath it, A to Z by name. */
export function countryPickerOptions(): EntityOption[] {
  const names = new Intl.DisplayNames(["en-GB"], { type: "region" });
  return COUNTRY_CODES.map((code) => ({
    id: code,
    label: names.of(code) ?? code,
    description: code,
  })).sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
}
