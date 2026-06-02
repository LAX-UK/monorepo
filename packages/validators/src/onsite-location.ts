/** Pure helpers for onsite auction location data.
 * * The onsite-event model stores both structured UK-friendly address fields
 * (`locationAddressLine1`, `locationCity`, `locationPostcode`, ...) and a
 * legacy free-form `locationAddress`. UI and validators ask the helpers in
 * this module to:
 * 1. validate / normalize UK postcodes consistently;
 * 2. assemble a single human-readable address string;
 * 3. derive a Google Maps "directions" URL without depending on a Google
 * API key (so onsite events get a maps preview/link out of the box).
 * * Keeping all of this logic in a single, dependency-free module lets routes,
 * services, and React components share the same behavior (DIP / SRP) and
 * keeps controllers thin.
 */

/** UK postcode regex (case-insensitive, optional space). Source: gov.uk
 * "Bulk Data Transfer" specification, simplified for client-side validation.
 * * This is intentionally lenient: we want to catch obvious typos in the admin
 * form without rejecting valid Crown Dependency or BFPO postcodes.
 */
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

/** Returns true iff `value` looks like a valid UK postcode. */
export function isUkPostcode(value: string): boolean {
  return UK_POSTCODE_REGEX.test(value.trim());
}

/** Normalize a UK postcode to uppercase with a single space before the
 * inward code, e.g. `sw1y6qu` -> `SW1Y 6QU`. Returns the original trimmed
 * input when it is not a recognizable UK postcode (so we never silently
 * drop user data).
 */
export function normalizeUkPostcode(value: string): string {
  const trimmed = value.trim();
  const match = UK_POSTCODE_REGEX.exec(trimmed);
  if (!match) return trimmed;
  const outward = match[1] ?? "";
  const inward = match[2] ?? "";
  return `${outward.toUpperCase()} ${inward.toUpperCase()}`;
}

/** Structured onsite address parts (subset of `Sale`). */
export type OnsiteAddressParts = {
  readonly locationName?: string | null;
  readonly locationAddress?: string | null;
  readonly locationAddressLine1?: string | null;
  readonly locationAddressLine2?: string | null;
  readonly locationCity?: string | null;
  readonly locationCounty?: string | null;
  readonly locationPostcode?: string | null;
  readonly locationCountry?: string | null;
};

export type OnsiteLocationPublishParts = OnsiteAddressParts & {
  readonly venueId?: string | null;
};

function nonEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Returns true when the structured UK address fields contain at least one
 * piece of data (so callers know whether to prefer them over the legacy
 * `locationAddress` string).
 */
export function hasStructuredAddress(parts: OnsiteAddressParts): boolean {
  return Boolean(
    nonEmpty(parts.locationAddressLine1) ||
      nonEmpty(parts.locationAddressLine2) ||
      nonEmpty(parts.locationCity) ||
      nonEmpty(parts.locationCounty) ||
      nonEmpty(parts.locationPostcode) ||
      nonEmpty(parts.locationCountry),
  );
}

/** True when manual onsite location fields are populated enough to publish. */
export function isOnsiteLocationPopulated(parts: OnsiteAddressParts): boolean {
  const name = nonEmpty(parts.locationName);
  if (!name) return false;
  return hasStructuredAddress(parts) || Boolean(nonEmpty(parts.locationAddress));
}

/** True when an onsite sale has a saved venue or enough manual location to publish. */
export function isOnsiteLocationReadyForPublish(parts: OnsiteLocationPublishParts): boolean {
  if (nonEmpty(parts.venueId)) return true;
  return isOnsiteLocationPopulated(parts);
}

/** Assemble a single-line, human-readable address from structured fields.
 * Falls back to `locationAddress` when no structured fields are populated,
 * and to an empty string when neither source has data.
 */
export function formatPostalAddress(parts: OnsiteAddressParts): string {
  if (!hasStructuredAddress(parts)) {
    return nonEmpty(parts.locationAddress) ?? "";
  }
  const line1 = nonEmpty(parts.locationAddressLine1);
  const line2 = nonEmpty(parts.locationAddressLine2);
  const city = nonEmpty(parts.locationCity);
  const county = nonEmpty(parts.locationCounty);
  const postcode = nonEmpty(parts.locationPostcode);
  const country = nonEmpty(parts.locationCountry);
  const cityLine = [city, county].filter(Boolean).join(", ");
  const cityWithPostcode = [cityLine, postcode].filter(Boolean).join(" ").trim();
  return [line1, line2, cityWithPostcode, country].filter(Boolean).join(", ");
}

/** Multi-line postal address, suitable for rendering in a column with
 * `whitespace-pre-line`. Mirrors how UK addresses are typically printed
 * on envelopes.
 */
export function formatPostalAddressLines(parts: OnsiteAddressParts): string[] {
  if (!hasStructuredAddress(parts)) {
    const fallback = nonEmpty(parts.locationAddress);
    return fallback
      ? fallback
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }
  const line1 = nonEmpty(parts.locationAddressLine1);
  const line2 = nonEmpty(parts.locationAddressLine2);
  const city = nonEmpty(parts.locationCity);
  const county = nonEmpty(parts.locationCounty);
  const postcode = nonEmpty(parts.locationPostcode);
  const country = nonEmpty(parts.locationCountry);
  const lines: string[] = [];
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);
  if (city) lines.push(city);
  if (county) lines.push(county);
  if (postcode) lines.push(postcode);
  if (country) lines.push(country);
  return lines;
}

/** Build a Google Maps "search" URL from structured address parts and the
 * optional venue name. We use the `?api=1&query=...` form, which:
 * 1. does NOT require a Google Maps API key;
 * 2. opens the Maps app on iOS/Android and the web Maps site on desktop;
 * 3. degrades gracefully when only some fields are present.
 * * Returns `null` if there is nothing to search for (callers should then
 * fall back to a custom `locationMapUrl`, if any).
 */
export function buildGoogleMapsSearchUrl(parts: OnsiteAddressParts): string | null {
  const venue = nonEmpty(parts.locationName);
  const address = formatPostalAddress(parts);
  const query = [venue, address].filter(Boolean).join(", ").trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Build a Google Maps embed URL (no key) using the public `/maps?output=embed`
 * endpoint, suitable for use in an `<iframe>` for a non-interactive preview.
 * * Note: the embed endpoint is rate-limited and does not support all features
 * of the Maps Embed API, but it works without a key for simple address
 * previews and is good enough for an onsite venue card.
 */
export function buildGoogleMapsEmbedUrl(parts: OnsiteAddressParts): string | null {
  const venue = nonEmpty(parts.locationName);
  const address = formatPostalAddress(parts);
  const query = [venue, address].filter(Boolean).join(", ").trim();
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** Resolve the best "open in maps" URL for an onsite sale: prefer an
 * explicit `locationMapUrl` set by the admin, else fall back to a
 * generated Google Maps search URL.
 */
export function resolveOnsiteMapUrl(
  parts: OnsiteAddressParts & { readonly locationMapUrl?: string | null },
): string | null {
  const explicit = nonEmpty(parts.locationMapUrl);
  if (explicit) return explicit;
  return buildGoogleMapsSearchUrl(parts);
}
