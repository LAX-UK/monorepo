import "server-only";

import { SITE_BUSINESS_ADDRESS } from "@/lib/brand";
import { isValidCountryCode } from "@auction/validators";
import type { CountryCode } from "libphonenumber-js";
import { headers } from "next/headers";

const GEO_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

function headerCountryIso2(value: string | null): CountryCode | null {
  if (!value) return null;
  const cc = value.trim().toUpperCase();
  if (cc.length !== 2 || cc === "XX" || cc === "T1") return null;
  return isValidCountryCode(cc) ? (cc as CountryCode) : null;
}

/** Pre-select country for phone fields: address hint → edge GeoIP → site default (GB). */
export async function resolvePhoneDefaultCountry(
  addressCountry?: string | null,
): Promise<CountryCode> {
  if (addressCountry?.trim()) {
    const normalized = addressCountry.trim().slice(0, 2).toUpperCase();
    if (isValidCountryCode(normalized)) return normalized as CountryCode;
  }

  const h = await headers();
  for (const key of GEO_HEADERS) {
    const cc = headerCountryIso2(h.get(key));
    if (cc) return cc;
  }

  const site = SITE_BUSINESS_ADDRESS.addressCountry?.trim().toUpperCase();
  if (site && isValidCountryCode(site)) return site as CountryCode;
  return "GB";
}
