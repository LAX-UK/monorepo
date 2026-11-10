import { cityName } from "./city.js";
import { offsetMinutes } from "./offset.js";
import { shortZoneName } from "./zone-formats.js";
import { isPlaceholderZone, isValidZone } from "./zone.js";

/** One place a time zone can be chosen by, as a staff list shows it. */
export type ZoneChoice = {
  /** The IANA name, e.g. "America/New_York". */
  zone: string;
  /** "New York (EST)": the city and the zone's short name at that moment. */
  label: string;
  /** The IANA name's first part ("America"), to tell places with the same city name apart. */
  region: string;
};

/**
 * Every short name a zone uses across the year, standard time first: "GMT/BST" for London,
 * "GMT+10/GMT+11" for Sydney, "GMT+4" for a zone that keeps one offset.
 */
export function zoneAbbreviations(zone: string, at: Date): string {
  const year = at.getUTCFullYear();
  const samples = [Date.UTC(year, 0, 15, 12), Date.UTC(year, 6, 15, 12)].map((t) => new Date(t));
  const [first, second] = samples as [Date, Date];
  const standardFirst = offsetMinutes(first, zone) <= offsetMinutes(second, zone);
  const ordered = standardFirst ? [first, second] : [second, first];
  return [...new Set(ordered.map((sample) => shortZoneName(zone, sample)))].join("/");
}

/** "London (GMT/BST)": the city and every name the zone uses in the year, not today's alone. */
export function zoneChoiceLabel(zone: string, at: Date): string {
  return `${cityName(zone)} (${zoneAbbreviations(zone, at)})`;
}

/** The label beside staff date inputs: "Times are in London time (GMT/BST)". */
export function timesAreInLabel(zone: string, at: Date): string {
  return `Times are in ${cityName(zone)} time (${zoneAbbreviations(zone, at)})`;
}

/** Names the runtime still lists under their retired spelling; staff look for the current one. */
const CURRENT_NAME: Readonly<Record<string, string>> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
};

function currentName(zone: string): string {
  const current = CURRENT_NAME[zone];
  return current && isValidZone(current) ? current : zone;
}

/**
 * Every zone that names a place, for a searchable list: sorted by label, with UTC and the fixed
 * `Etc/*` zones left out.
 */
export function listZoneChoices(at: Date): ZoneChoice[] {
  return Intl.supportedValuesOf("timeZone")
    .map(currentName)
    .filter((zone) => isValidZone(zone) && !isPlaceholderZone(zone))
    .map((zone) => ({
      zone,
      label: zoneChoiceLabel(zone, at),
      region: zone.split("/")[0] ?? zone,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB") || a.zone.localeCompare(b.zone));
}
