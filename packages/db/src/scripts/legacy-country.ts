import { ADDRESS_COUNTRY_CODES } from "@auction/identity-contracts";

const ISO_ALPHA2 = /^[A-Z]{2}$/;

const ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  usa: "US",
  "united states of america": "US",
  "south korea": "KR",
  "north korea": "KP",
  russia: "RU",
  uae: "AE",
  holland: "NL",
  "czech republic": "CZ",
};

let namesToCodes: Map<string, string> | null = null;

function regionNames(): Map<string, string> {
  if (namesToCodes) return namesToCodes;
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const map = new Map<string, string>();
  for (const first of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    for (const second of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const code = `${first}${second}`;
      const name = display.of(code);
      // Intl also knows reserved codes such as "UK"; only codes the address book accepts count.
      if (name && name !== code && ADDRESS_COUNTRY_CODES.includes(code)) {
        map.set(name.toLowerCase(), code);
      }
    }
  }
  namesToCodes = map;
  return map;
}

/**
 * Bid stored a free-text country. Returns the ISO 3166-1 alpha-2 code for an ISO code, an
 * English country name or a common alias, or null when the text cannot be read with confidence
 * (the address is then left in Bid's table for a person to fix, never guessed).
 */
export function legacyCountryToIso(raw: string): string | null {
  const text = raw.trim();
  const upper = text.toUpperCase();
  if (ISO_ALPHA2.test(upper) && ADDRESS_COUNTRY_CODES.includes(upper)) return upper;
  const key = text.toLowerCase().replace(/\s+/g, " ");
  return ALIASES[key] ?? regionNames().get(key) ?? null;
}
