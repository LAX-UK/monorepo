/**
 * The zone a sale in a country runs on, for the countries LAX holds or may hold sales in that
 * keep a single zone. A country spanning several (the United States, Canada, Australia) is left
 * out on purpose: it has no one right answer, so staff choose.
 */
const ZONE_BY_COUNTRY: Readonly<Record<string, string>> = {
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  england: "Europe/London",
  scotland: "Europe/London",
  wales: "Europe/London",
  "northern ireland": "Europe/London",
  ireland: "Europe/Dublin",
  france: "Europe/Paris",
  monaco: "Europe/Monaco",
  germany: "Europe/Berlin",
  italy: "Europe/Rome",
  spain: "Europe/Madrid",
  portugal: "Europe/Lisbon",
  netherlands: "Europe/Amsterdam",
  belgium: "Europe/Brussels",
  switzerland: "Europe/Zurich",
  austria: "Europe/Vienna",
  greece: "Europe/Athens",
  sweden: "Europe/Stockholm",
  denmark: "Europe/Copenhagen",
  norway: "Europe/Oslo",
  "united arab emirates": "Asia/Dubai",
  uae: "Asia/Dubai",
  qatar: "Asia/Qatar",
  "saudi arabia": "Asia/Riyadh",
  india: "Asia/Kolkata",
  singapore: "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  japan: "Asia/Tokyo",
  "south korea": "Asia/Seoul",
  "new zealand": "Pacific/Auckland",
};

/** The venue country's zone, or null when the country is not given or has no single zone. */
export function zoneForVenueCountry(country: string | null | undefined): string | null {
  const key = country?.trim().toLowerCase().replace(/\s+/g, " ");
  return key ? (ZONE_BY_COUNTRY[key] ?? null) : null;
}
