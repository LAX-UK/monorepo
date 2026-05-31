import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const PRIORITY: CountryCode[] = ["GB", "US", "IE", "FR", "DE", "CH", "HK", "SG", "AU", "CA"];

export function isValidCountryCode(value: string): boolean {
  return getCountries().includes(value as CountryCode);
}

export type PhoneCountryOption = {
  value: CountryCode;
  label: string;
  keywords: string;
  callingCode: string;
};

let cachedOptions: PhoneCountryOption[] | null = null;

/** Searchable country list for phone UI (ISO2 value, label includes dial code). */
export function getPhoneCountryOptions(): PhoneCountryOption[] {
  if (cachedOptions) return cachedOptions;

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const all = getCountries().map((cc): PhoneCountryOption => {
    const callingCode = `+${getCountryCallingCode(cc)}`;
    const name = displayNames.of(cc) ?? cc;
    return {
      value: cc,
      callingCode,
      label: `${name} (${callingCode})`,
      keywords: `${name} ${cc} ${callingCode}`,
    };
  });

  const prioritySet = new Set(PRIORITY);
  const prioritized = PRIORITY.flatMap((cc) => {
    const opt = all.find((o) => o.value === cc);
    return opt ? [opt] : [];
  });
  const rest = all
    .filter((o) => !prioritySet.has(o.value))
    .sort((a, b) => a.label.localeCompare(b.label));

  cachedOptions = [...prioritized, ...rest];
  return cachedOptions;
}

export function splitE164ForForm(
  e164: string | null | undefined,
  fallbackCountry: CountryCode = "GB",
  hintCountry?: string | null,
): { country: CountryCode; number: string } {
  if (!e164?.trim()) {
    const hint =
      hintCountry && isValidCountryCode(hintCountry.toUpperCase())
        ? (hintCountry.toUpperCase() as CountryCode)
        : fallbackCountry;
    return { country: hint, number: "" };
  }
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.isValid() && parsed.country) {
    return {
      country: parsed.country,
      number: parsed.formatNational().replace(/^\s+/, ""),
    };
  }
  return { country: fallbackCountry, number: e164 };
}
