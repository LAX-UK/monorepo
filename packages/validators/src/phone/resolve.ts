import { type NormalizedPhone, normalizeLegacyMobile, normalizePhoneInput } from "./normalize.js";

export type PhoneInputValues = {
  country: string;
  number: string;
};

type StoredPhone = NormalizedPhone;

export type ResolvePhoneResult =
  | { ok: true; value: StoredPhone | undefined }
  | { ok: false; message: string; path: (string | number)[] };

export function resolvePhoneFromBody(data: {
  phone?: PhoneInputValues | null | undefined;
  mobile?: string | null | undefined;
  mobileCountry?: string | undefined;
}): ResolvePhoneResult {
  if (data.phone === null) {
    return { ok: true, value: undefined };
  }

  if (data.phone?.number?.trim()) {
    const r = normalizePhoneInput(data.phone);
    if (!r.ok) return { ok: false, message: r.message, path: ["phone", "number"] };
    return { ok: true, value: r.value };
  }

  const legacy = data.mobile?.trim();
  if (legacy) {
    const r = normalizeLegacyMobile(legacy, data.mobileCountry ?? undefined);
    if (!r.ok) return { ok: false, message: r.message, path: ["mobile"] };
    return { ok: true, value: r.value };
  }

  if (data.mobile === null) {
    return { ok: true, value: undefined };
  }

  return { ok: true, value: undefined };
}
