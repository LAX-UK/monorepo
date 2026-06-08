import type { ConnectAddressSnapshot } from "./connect-address-snapshot.js";

const ISO_ALPHA2 = /^[A-Z]{2}$/;
const DEFAULT_COUNTRY = "GB";

export type ConnectCountrySources = {
  entityAddress: ConnectAddressSnapshot | null;
  userAddress: ConnectAddressSnapshot | null;
  kycIdCountry: string | null;
};

/** Normalize and validate ISO 3166-1 alpha-2 country codes for Stripe account creation. */
export function normalizeConnectCountryCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  return ISO_ALPHA2.test(upper) ? upper : null;
}

/**
 * Stripe connected-account `country` is immutable after creation.
 * Resolution order: entity address → user address → KYC document country → GB.
 */
export function resolveConnectAccountCountry(sources: ConnectCountrySources): string {
  const candidates = [
    sources.entityAddress?.country,
    sources.userAddress?.country,
    sources.kycIdCountry,
    DEFAULT_COUNTRY,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeConnectCountryCode(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_COUNTRY;
}
