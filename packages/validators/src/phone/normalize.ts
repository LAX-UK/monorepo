import {
  type CountryCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";

export type PhoneInput = {
  country: string;
  number: string;
};

export type NormalizedPhone = {
  e164: string;
  country: CountryCode;
};

export type NormalizePhoneResult =
  | { ok: true; value: NormalizedPhone }
  | { ok: false; code: "invalid_phone"; message: string };

const DEFAULT_REGION: CountryCode = "GB";

export function toCountryCode(
  value: string | undefined,
  fallback: CountryCode = DEFAULT_REGION,
): CountryCode {
  const cc = (value?.trim().toUpperCase() ?? fallback) as CountryCode;
  return cc;
}

/** Parse national or international input; returns E.164 when valid. */
export function normalizePhoneInput(
  input: PhoneInput,
  defaultRegion: CountryCode = DEFAULT_REGION,
): NormalizePhoneResult {
  const raw = input.number?.trim() ?? "";
  if (!raw) {
    return { ok: false, code: "invalid_phone", message: "Phone number is required when provided" };
  }

  const region = toCountryCode(input.country, defaultRegion);
  const parsed = parsePhoneNumberFromString(raw, raw.startsWith("+") ? undefined : region);

  if (!parsed) {
    return {
      ok: false,
      code: "invalid_phone",
      message: `Enter a valid phone number for ${regionDisplayName(region)}`,
    };
  }

  const country = parsed.country;
  if (!country || !isValidPhoneNumber(parsed.number, country)) {
    return {
      ok: false,
      code: "invalid_phone",
      message: `Enter a valid phone number for ${country ? regionDisplayName(country) : region}`,
    };
  }

  return {
    ok: true,
    value: {
      e164: parsed.format("E.164"),
      country,
    },
  };
}

/** Legacy single-field mobile + optional ISO hint. */
export function normalizeLegacyMobile(
  mobile: string,
  mobileCountry?: string | undefined,
  defaultRegion: CountryCode = DEFAULT_REGION,
): NormalizePhoneResult {
  const trimmed = mobile.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid_phone", message: "Phone number is empty" };
  }
  const region = mobileCountry ? toCountryCode(mobileCountry, defaultRegion) : defaultRegion;
  return normalizePhoneInput({ country: region, number: trimmed }, defaultRegion);
}

/** Digits-only form for PII hashing (Meta CAPI `ph`). */
export function phoneDigitsForPiiHash(e164OrRaw: string): string {
  return e164OrRaw.replace(/\D/g, "");
}

function regionDisplayName(region: CountryCode): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}
