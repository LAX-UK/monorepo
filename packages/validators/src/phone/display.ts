import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Human-readable international format for stored E.164. */
export function formatPhoneDisplay(e164: string | null | undefined): string | null {
  if (!e164?.trim()) return null;
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.isValid()) {
    return parsed.formatInternational();
  }
  return e164;
}
